import tls from 'node:tls';
import type { CheckResult, MonitorSpec } from './types.js';

export function checkSsl(m: MonitorSpec): Promise<CheckResult> {
  const warnDays = m.config.sslWarnDays ?? 14;
  let host = m.target;
  let port = m.config.port ?? 443;
  try {
    if (host.includes('://')) {
      const u = new URL(host);
      host = u.hostname;
      port = u.port ? Number(u.port) : port;
    }
  } catch { /* use raw target */ }
  const start = performance.now();
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port, servername: host, timeout: m.timeoutS * 1000 }, () => {
      const cert = sock.getPeerCertificate();
      const authorized = sock.authorized;
      const authError = sock.authorizationError;
      sock.destroy();
      const latencyMs = Math.round(performance.now() - start);
      if (!cert?.valid_to) return resolve({ ok: false, latencyMs, error: 'No certificate' });
      const sslDaysLeft = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      if (!authorized) return resolve({ ok: false, latencyMs, sslDaysLeft, error: `Invalid certificate: ${authError}` });
      if (sslDaysLeft < warnDays) return resolve({ ok: false, latencyMs, sslDaysLeft, error: `Certificate expires in ${sslDaysLeft} days` });
      resolve({ ok: true, latencyMs, sslDaysLeft });
    });
    sock.once('timeout', () => { sock.destroy(); resolve({ ok: false, error: 'Timed out' }); });
    sock.once('error', (e) => resolve({ ok: false, error: e.message }));
  });
}
