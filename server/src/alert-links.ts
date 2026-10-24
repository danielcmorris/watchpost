import { createHmac, timingSafeEqual } from 'node:crypto';

const LIFE_MS = 7 * 24 * 60 * 60 * 1000;

function signature(monitorId: number, expires: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`watchpost-alert-v1:${monitorId}:${expires}`).digest();
}

/** A signed link only authorizes the read-only view of one monitor. */
export function signedMonitorUrl(baseUrl: string, monitorId: number, secret: string, now = Date.now()): string {
  const expires = Math.floor((now + LIFE_MS) / 1000);
  const token = `${expires}.${signature(monitorId, expires, secret).toString('base64url')}`;
  const url = new URL(`/alert/monitors/${monitorId}`, baseUrl);
  // Fragments are kept by the browser, but are not sent to the proxy or access logs.
  url.hash = `t=${token}`;
  return url.toString();
}

export function validMonitorToken(token: unknown, monitorId: number, secret: string, now = Date.now()): boolean {
  if (typeof token !== 'string' || !Number.isSafeInteger(monitorId) || monitorId < 1) return false;
  const match = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  const current = Math.floor(now / 1000);
  if (expires <= current || expires > current + Math.ceil(LIFE_MS / 1000)) return false;
  const supplied = Buffer.from(match[2], 'base64url');
  const expected = signature(monitorId, expires, secret);
  return supplied.length === expected.length && supplied.toString('base64url') === match[2] && timingSafeEqual(supplied, expected);
}
