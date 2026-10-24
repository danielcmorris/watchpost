export interface AlertMessage { subject: string; text: string; html: string }

export type AlertInput = {
  kind: 'down' | 'up' | 'ssl';
  monitor: { id: number; name: string; type: string; target: string; port?: number };
  /** Why it failed (down), or what is wrong with the certificate (ssl). */
  reason?: string;
  /** When the outage began (down/up) */
  startedAt?: Date;
  /** When it recovered (up) */
  resolvedAt?: Date;
  /** Signed, time-limited URL for the read-only monitor view. */
  signedMonitorUrl: string;
};

const TYPE_LABEL: Record<string, string> = {
  http: 'HTTP(S) check', keyword: 'Keyword check', ping: 'Ping', tcp: 'TCP port', ssl: 'SSL certificate',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Show where a monitor points without leaking query strings (they often carry tokens). */
export function displayTarget(type: string, target: string, port?: number): string {
  if (type === 'http' || type === 'keyword' || target.includes('://')) {
    try {
      const u = new URL(target);
      return `${u.origin}${u.pathname === '/' ? '' : u.pathname}${u.search || u.hash ? '?…' : ''}`;
    } catch { /* fall through */ }
  }
  return port ? `${target}:${port}` : target;
}

export function formatTime(d: Date): string {
  return `${d.toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}${rm ? ` ${rm} min` : ''}`;
  const dd = Math.floor(h / 24), rh = h % 24;
  return `${dd} day${dd === 1 ? '' : 's'}${rh ? ` ${rh} hr` : ''}`;
}

export function alertEmail(i: AlertInput): AlertMessage {
  const monitorUrl = i.signedMonitorUrl;
  const m = i.monitor;
  const target = displayTarget(m.type, m.target, m.port);

  const palette = {
    down: { color: '#d83a2e', tint: '#fdecea', label: 'Down' },
    up: { color: '#1f9255', tint: '#e8f6ee', label: 'Back up' },
    ssl: { color: '#c28a12', tint: '#fcf4e1', label: 'Certificate' },
  }[i.kind];

  let headline: string, subject: string, preheader: string;
  const rows: [string, string][] = [['Monitor', m.name], ['Target', target], ['Type', TYPE_LABEL[m.type] ?? m.type]];

  if (i.kind === 'down') {
    headline = `${m.name} is down`;
    subject = `Down: ${m.name}`;
    preheader = i.reason ?? 'The latest checks failed.';
    rows.push(['Status', 'Down']);
    if (i.reason) rows.push(['Cause', i.reason]);
    rows.push(['Detected', formatTime(i.startedAt ?? new Date())]);
  } else if (i.kind === 'up') {
    headline = `${m.name} is back up`;
    subject = `Recovered: ${m.name}`;
    const dur = i.startedAt && i.resolvedAt ? formatDuration(i.resolvedAt.getTime() - i.startedAt.getTime()) : undefined;
    preheader = dur ? `It was down for ${dur}.` : 'Checks are passing again.';
    rows.push(['Status', 'Up']);
    if (i.startedAt) rows.push(['Went down', formatTime(i.startedAt)]);
    rows.push(['Recovered', formatTime(i.resolvedAt ?? new Date())]);
    if (dur) rows.push(['Downtime', dur]);
  } else {
    headline = `Certificate problem for ${m.name}`;
    subject = `SSL certificate: ${m.name}`;
    preheader = i.reason ?? 'There is a problem with the SSL certificate.';
    if (i.reason) rows.push(['Issue', i.reason]);
    rows.push(['Checked', formatTime(new Date())]);
  }

  const text = [
    headline, '', ...rows.map(([k, v]) => `${k.padEnd(10)} ${v}`), '',
    `View monitor (link expires in 7 days): ${monitorUrl}`, '',
    '--', 'Watchpost. You get this email because you are an alert contact for this monitor.',
  ].join('\n');

  const detail = rows.map(([k, v], idx) => `
          <tr>
            <td style="padding:10px 0;${idx ? 'border-top:1px solid #e6ebe9;' : ''}width:104px;color:#566c72;font-size:14px;vertical-align:top;">${esc(k)}</td>
            <td style="padding:10px 0;${idx ? 'border-top:1px solid #e6ebe9;' : ''}color:#0f2127;font-size:14px;font-weight:${k === 'Cause' || k === 'Issue' ? '600' : '500'};word-break:break-word;">${esc(v)}</td>
          </tr>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f4f3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f3;">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:0 4px 14px;font-size:16px;font-weight:700;letter-spacing:-0.01em;color:#0f2127;">
        <span style="color:#0f2127;">Watchpost</span>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #dbe3e0;border-radius:14px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="height:5px;line-height:5px;font-size:0;background:${palette.color};">&nbsp;</td></tr>
          <tr><td style="padding:26px 28px 6px;">
            <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${palette.tint};color:${palette.color};font-size:12.5px;font-weight:700;">${palette.label}</span>
            <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#0f2127;">${esc(headline)}</h1>
          </td></tr>
          <tr><td style="padding:14px 28px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detail}
            </table>
          </td></tr>
          <tr><td style="padding:18px 28px 28px;">
            <a href="${esc(monitorUrl)}" style="display:inline-block;padding:11px 22px;border-radius:9px;background:#14707e;color:#ffffff;font-size:14.5px;font-weight:600;text-decoration:none;">View monitor without signing in</a>
            <p style="margin:12px 0 0;color:#566c72;font-size:12.5px;">This read-only link expires in 7 days. Anyone with the email can use it until then.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 6px 0;font-size:12.5px;line-height:1.6;color:#566c72;">
        You&rsquo;re receiving this because you are an alert contact for this monitor.
        Manage contacts and alerts in Watchpost after signing in.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
