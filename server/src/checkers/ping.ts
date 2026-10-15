import { execFile } from 'node:child_process';
import type { CheckResult, MonitorSpec } from './types.js';

const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function checkPing(m: MonitorSpec): Promise<CheckResult> {
  if (!HOST_RE.test(m.target)) return Promise.resolve({ ok: false, error: 'Invalid host' });
  return new Promise((resolve) => {
    execFile('ping', ['-c', '1', '-W', String(m.timeoutS), m.target], { timeout: (m.timeoutS + 2) * 1000 }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: 'No reply' });
      const t = /time[=<]([\d.]+)\s*ms/.exec(stdout);
      resolve({ ok: true, latencyMs: t ? Math.round(parseFloat(t[1])) : undefined });
    });
  });
}
