import { describe, expect, it } from 'vitest';
import { signedMonitorUrl, validMonitorToken } from './alert-links.js';

const now = Date.parse('2026-10-24T12:00:00Z');
const secret = 'a-secret-that-is-long-enough-for-tests';

describe('signed monitor links', () => {
  it('opens only the named monitor and expires after seven days', () => {
    const url = new URL(signedMonitorUrl('https://uptime.example.com/', 7, secret, now));
    const token = new URLSearchParams(url.hash.slice(1)).get('t');
    expect(url.pathname).toBe('/alert/monitors/7');
    expect(validMonitorToken(token, 7, secret, now)).toBe(true);
    expect(validMonitorToken(token, 8, secret, now)).toBe(false);
    expect(validMonitorToken(token, 7, secret, now + 7 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('rejects modified and malformed signatures', () => {
    const token = new URLSearchParams(new URL(signedMonitorUrl('https://uptime.example.com', 7, secret, now)).hash.slice(1)).get('t')!;
    expect(validMonitorToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), 7, secret, now)).toBe(false);
    expect(validMonitorToken(token, 7, 'different-secret', now)).toBe(false);
    expect(validMonitorToken('bad', 7, secret, now)).toBe(false);
  });
});
