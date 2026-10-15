import type { CheckResult, MonitorSpec } from './types.js';

const MAX_BODY = 1024 * 1024;

export async function checkHttp(m: MonitorSpec): Promise<CheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(m.target, {
      signal: AbortSignal.timeout(m.timeoutS * 1000),
      redirect: 'follow',
      headers: { 'user-agent': 'uptime-monitor/1.0' },
    });
    const statusCode = res.status;
    const expected = m.config.expectedStatus;
    const statusOk = expected?.length ? expected.includes(statusCode) : statusCode >= 200 && statusCode < 400;

    let keywordOk = true;
    if (m.type === 'keyword' && m.config.keyword) {
      const body = (await res.text()).slice(0, MAX_BODY);
      const found = body.includes(m.config.keyword);
      keywordOk = m.config.keywordMode === 'absent' ? !found : found;
    } else {
      await res.body?.cancel();
    }
    const latencyMs = Math.round(performance.now() - start);
    if (!statusOk) return { ok: false, latencyMs, statusCode, error: `Unexpected status ${statusCode}` };
    if (!keywordOk) {
      const mode = m.config.keywordMode === 'absent' ? 'present (should be absent)' : 'not found';
      return { ok: false, latencyMs, statusCode, error: `Keyword "${m.config.keyword}" ${mode}` };
    }
    return { ok: true, latencyMs, statusCode };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'TimeoutError') return 'Timed out';
    const cause = (e as { cause?: { code?: string } }).cause;
    return cause?.code ? `${e.message} (${cause.code})` : e.message;
  }
  return String(e);
}
