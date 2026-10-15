import net from 'node:net';
import type { CheckResult, MonitorSpec } from './types.js';

export function checkTcp(m: MonitorSpec): Promise<CheckResult> {
  const port = m.config.port;
  if (!port) return Promise.resolve({ ok: false, error: 'No port configured' });
  const start = performance.now();
  return new Promise((resolve) => {
    const sock = net.connect({ host: m.target, port, timeout: m.timeoutS * 1000 });
    const done = (r: CheckResult) => { sock.destroy(); resolve(r); };
    sock.once('connect', () => done({ ok: true, latencyMs: Math.round(performance.now() - start) }));
    sock.once('timeout', () => done({ ok: false, error: 'Timed out' }));
    sock.once('error', (e) => done({ ok: false, error: e.message }));
  });
}
