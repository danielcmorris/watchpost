// Import monitors and email alert contacts from UptimeRobot (API v3) into this app.
//
//   UPTIMEROBOT_API_KEY=... ADMIN_PASSWORD=... node scripts/import-uptimerobot.mjs [--dry-run] [--history]
//
// Env:
//   UPTIMEROBOT_API_KEY   your UptimeRobot API key (or UPTIMEROBOT_KEY_FILE=/path/to/file)
//   TARGET                this app's base URL            (default http://localhost:4250)
//   ADMIN_USERNAME        admin login                    (default admin)
//   ADMIN_PASSWORD        admin password
// --history  also backfill past incidents and daily uptime (from UptimeRobot's incident log).
//            Only data from before a monitor was created here is accepted, so it is safe to re-run.
// Existing monitors with the same name are skipped, so it is safe to re-run.
// Unsupported contact types (SMS, voice, webhooks...) and monitor types are skipped.
import { readFileSync } from 'node:fs';

const dry = process.argv.includes('--dry-run');
const history = process.argv.includes('--history');
const target = (process.env.TARGET ?? 'http://localhost:4250').replace(/\/$/, '');
const key = (process.env.UPTIMEROBOT_API_KEY ??
  (process.env.UPTIMEROBOT_KEY_FILE ? readFileSync(process.env.UPTIMEROBOT_KEY_FILE, 'utf8') : '')).trim();
const user = process.env.ADMIN_USERNAME ?? 'admin';
const pass = process.env.ADMIN_PASSWORD;
if (!key || !pass) {
  console.error('Set UPTIMEROBOT_API_KEY (or UPTIMEROBOT_KEY_FILE) and ADMIN_PASSWORD');
  process.exit(1);
}

const ur = async (p) => {
  const r = await fetch(`https://api.uptimerobot.com/v3/${p}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`UptimeRobot ${p}: HTTP ${r.status}`);
  return (await r.json()).data;
};

let cookie = '';
async function api(path, method = 'GET', body) {
  const r = await fetch(target + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0]; // Secure flag ignored: we may talk plain HTTP on the LAN
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}

const [urMonitors, urContacts] = await Promise.all([ur('monitors'), ur('alert-contacts')]);
await api('/api/auth/login', 'POST', { username: user, password: pass });

// Contacts: only Email is supported.
const haveContacts = await api('/api/contacts');
const contactMap = new Map(); // UptimeRobot id -> local id
for (const c of urContacts) {
  if (c.type !== 'Email') { console.log(`skip contact ${c.id} (${c.type}, not supported)`); continue; }
  let local = haveContacts.find((x) => x.email === c.value);
  if (!local && !dry) local = { id: (await api('/api/contacts', 'POST', { name: c.friendlyName ?? c.value, email: c.value })).id };
  console.log(`${local ? 'have' : 'would create'} contact ${c.value}`);
  if (local) contactMap.set(c.id, local.id);
}

const haveMonitors = new Set((await api('/api/monitors')).map((m) => m.name));
for (const m of urMonitors) {
  const name = m.friendlyName.trim();
  if (haveMonitors.has(name)) { console.log(`exists: ${name}`); continue; }
  const config = {};
  let type;
  if (m.type === 'HTTP') type = 'http';
  else if (m.type === 'KEYWORD') {
    type = 'keyword';
    config.keyword = m.keywordValue;
    // ALERT_NOT_EXISTS = alert when keyword is missing => must be present
    config.keywordMode = m.keywordType === 'ALERT_EXISTS' ? 'absent' : 'present';
  } else if (m.type === 'PING') type = 'ping';
  else if (m.type === 'PORT') { type = 'tcp'; config.port = m.port; }
  else { console.log(`skip ${name}: unsupported type ${m.type}`); continue; }

  const target_ = type === 'ping' || type === 'tcp' ? new URL(m.url.includes('://') ? m.url : `x://${m.url}`).hostname : m.url;
  const body = {
    name, type, target: target_, config,
    interval_s: Math.max(30, m.interval), timeout_s: Math.min(60, m.timeout || 10),
    paused: m.status === 'PAUSED',
    contact_ids: (m.assignedAlertContacts ?? []).map((a) => contactMap.get(a.alertContactId)).filter(Boolean),
  };
  console.log(`${dry ? 'would create' : 'create'}: ${name} [${type}] ${target_}`);
  if (!dry) await api('/api/monitors', 'POST', body);
}

// ---------------------------------------------------------------------------
// History: incidents as-is, and daily uptime derived from them. Downtime on a
// day is the overlap of each incident with that UTC day (this matches
// UptimeRobot's own per-day uptime figures to the second).
if (history) {
  const DAY = 86_400_000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const incidents = [];
  let url = 'https://api.uptimerobot.com/v3/incidents';
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (r.status === 429) { await sleep(61_000); continue; } // rate limited: wait and retry
    if (!r.ok) throw new Error(`UptimeRobot incidents: HTTP ${r.status}`);
    const j = await r.json();
    incidents.push(...j.data);
    url = j.nextLink;
  }
  const downtime = incidents.filter((i) => i.type === 'Downtime');
  console.log(`fetched ${downtime.length} downtime incidents`);

  const local = new Map((await api('/api/monitors')).map((m) => [m.name, m.id]));
  const today = Math.floor(Date.now() / DAY) * DAY;
  for (const m of urMonitors) {
    const id = local.get(m.friendlyName.trim());
    if (!id) { console.log(`history: no local monitor for ${m.friendlyName}`); continue; }
    const mine = downtime.filter((i) => i.monitor.id === m.id);
    const first = Math.floor(new Date(m.createDateTime) / DAY) * DAY + DAY; // first full day
    const daily = [];
    for (let d0 = first; d0 < today; d0 += DAY) {
      const downMs = mine.reduce((s, i) => {
        const a = Math.max(new Date(i.startedAt).getTime(), d0);
        const b = Math.min(i.resolvedAt ? new Date(i.resolvedAt).getTime() : Date.now(), d0 + DAY);
        return s + Math.max(0, b - a);
      }, 0);
      // Nominal 1440 one-minute checks per day, scaled to the real uptime.
      daily.push({ day: new Date(d0).toISOString().slice(0, 10), total: 1440, ok: Math.round(1440 * (1 - downMs / DAY)) });
    }
    const body = {
      incidents: mine.map((i) => ({ started_at: new Date(i.startedAt).toISOString(), resolved_at: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : null, cause: i.reason ?? 'Downtime' })),
      daily,
    };
    console.log(`${dry ? 'would import' : 'import'} history: ${m.friendlyName.trim()}: ${body.incidents.length} incidents, ${daily.length} days`);
    if (!dry) {
      const res = await api(`/api/monitors/${id}/history`, 'POST', body);
      console.log(`  added ${res.incidents_added} incidents, ${res.days_added} days`);
    }
  }
}
