import { runCheck, type MonitorSpec } from '../checkers/index.js';
import { checkSsl } from '../checkers/ssl.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { sendAlert } from '../mailer.js';
import { nextState, type Status } from './state.js';

interface MonitorRow {
  id: number;
  name: string;
  type: MonitorSpec['type'];
  target: string;
  timeout_s: number;
  config: MonitorSpec['config'];
  status: Status;
  consecutive_failures: number;
  failure_threshold: number;
}

let inFlight = 0;
let timer: NodeJS.Timeout | undefined;
let stopped = false;
const sslChecked = new Map<number, number>();
const DAY = 86_400_000;

async function claimDue(limit: number): Promise<MonitorRow[]> {
  const { rows } = await pool.query<MonitorRow>(
    `UPDATE monitors SET next_check_at = now() + make_interval(secs => interval_s)
     WHERE id IN (
       SELECT id FROM monitors WHERE NOT paused AND next_check_at <= now()
       ORDER BY next_check_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING id, name, type, target, timeout_s, config, status, consecutive_failures, failure_threshold`,
    [limit],
  );
  return rows;
}

export async function processMonitor(m: MonitorRow): Promise<void> {
  const result = await runCheck({ type: m.type, target: m.target, timeoutS: m.timeout_s, config: m.config });
  await pool.query(
    'INSERT INTO checks (monitor_id, ok, latency_ms, status_code, error) VALUES ($1,$2,$3,$4,$5)',
    [m.id, result.ok, result.latencyMs ?? null, result.statusCode ?? null, result.error ?? null],
  );
  const s = nextState(
    { status: m.status, consecutiveFailures: m.consecutive_failures, failureThreshold: m.failure_threshold },
    result.ok,
  );
  await pool.query(
    'UPDATE monitors SET status=$2, consecutive_failures=$3, last_check_at=now() WHERE id=$1',
    [m.id, s.status, s.consecutiveFailures],
  );

  if (s.transition === 'down') {
    await pool.query('INSERT INTO incidents (monitor_id, cause) VALUES ($1,$2)', [m.id, result.error ?? 'Check failed']);
    await sendAlert(m.id, `🔴 DOWN: ${m.name}`, `${m.name} (${m.target}) is DOWN.\nCause: ${result.error ?? 'Check failed'}\nTime: ${new Date().toISOString()}`);
  } else if (s.transition === 'up') {
    const { rows } = await pool.query(
      'UPDATE incidents SET resolved_at=now() WHERE monitor_id=$1 AND resolved_at IS NULL RETURNING started_at',
      [m.id],
    );
    const since = rows[0]?.started_at ? ` Downtime started ${new Date(rows[0].started_at).toISOString()}.` : '';
    await sendAlert(m.id, `🟢 UP: ${m.name}`, `${m.name} (${m.target}) is back UP.${since}`);
  }

  // Daily certificate-expiry piggyback for HTTPS web monitors.
  if ((m.type === 'http' || m.type === 'keyword') && m.target.startsWith('https://')) {
    const last = sslChecked.get(m.id) ?? 0;
    if (Date.now() - last > DAY) {
      sslChecked.set(m.id, Date.now());
      const ssl = await checkSsl({ type: 'ssl', target: m.target, timeoutS: m.timeout_s, config: { sslWarnDays: m.config.sslWarnDays } });
      if (!ssl.ok) await sendAlert(m.id, `⚠️ SSL: ${m.name}`, `${m.name} (${m.target}) certificate problem: ${ssl.error}`);
    }
  }
}

async function tick(): Promise<void> {
  const room = config.scheduler.maxConcurrent - inFlight;
  if (room <= 0) return;
  let due: MonitorRow[];
  try {
    due = await claimDue(Math.min(room, config.scheduler.batch));
  } catch (e) {
    console.error('[scheduler] claim failed', e);
    return;
  }
  for (const m of due) {
    inFlight++;
    processMonitor(m)
      .catch((e) => console.error(`[scheduler] monitor ${m.id} failed`, e))
      .finally(() => { inFlight--; });
  }
}

/** Roll today's and yesterday's checks into check_daily, prune raw checks past retention. */
export async function maintenance(): Promise<void> {
  await pool.query(
    `INSERT INTO check_daily (monitor_id, day, total, ok, avg_latency_ms)
     SELECT monitor_id, ts::date, count(*), count(*) FILTER (WHERE ok), avg(latency_ms)::int
     FROM checks WHERE ts >= (current_date - 1) GROUP BY monitor_id, ts::date
     ON CONFLICT (monitor_id, day) DO UPDATE SET total=EXCLUDED.total, ok=EXCLUDED.ok, avg_latency_ms=EXCLUDED.avg_latency_ms`,
  );
  await pool.query(`DELETE FROM checks WHERE ts < now() - make_interval(days => $1)`, [config.scheduler.retentionDays]);
}

export function startScheduler(): void {
  const loop = async () => {
    if (stopped) return;
    await tick();
    timer = setTimeout(loop, config.scheduler.tickMs);
  };
  void loop();
  void maintenance().catch((e) => console.error('[maintenance]', e));
  setInterval(() => void maintenance().catch((e) => console.error('[maintenance]', e)), 60 * 60 * 1000).unref();
}

export function stopScheduler(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
}
