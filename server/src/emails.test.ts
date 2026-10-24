import { describe, expect, it } from 'vitest';
import { alertEmail, displayTarget, formatDuration } from './emails.js';

const mon = { id: 7, name: 'Billing <API>', type: 'keyword', target: 'https://example.com/health?sid=SECRET', port: undefined };
const signedMonitorUrl = 'https://status.example.org/alert/monitors/7#t=SIGNED';

describe('alertEmail', () => {
  it('uses the signed monitor link in both email formats', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, reason: 'Timed out', signedMonitorUrl });
    expect(e.html).toContain('href="https://status.example.org/alert/monitors/7#t=SIGNED"');
    expect(e.text).toContain(signedMonitorUrl);
    expect(e.html + e.text).toContain('7 days');
  });
  it('escapes HTML in names and reasons', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, reason: '<script>x</script>', signedMonitorUrl });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('Billing &lt;API&gt;');
  });
  it('never includes query strings from the target', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, signedMonitorUrl });
    expect(e.html + e.text).not.toContain('SECRET');
    expect(e.text).toContain('https://example.com/health?…');
  });
  it('reports downtime on recovery', () => {
    const e = alertEmail({ kind: 'up', monitor: mon, signedMonitorUrl, startedAt: new Date('2026-01-01T10:00:00Z'), resolvedAt: new Date('2026-01-01T10:04:10Z') });
    expect(e.subject).toBe('Recovered: Billing <API>');
    expect(e.text).toContain('4 minutes');
  });
});

describe('helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(50_000)).toBe('50 seconds');
    expect(formatDuration(61_000)).toBe('1 minute');
    expect(formatDuration(3 * 3600_000 + 5 * 60_000)).toBe('3 hours 5 min');
  });
  it('shows host:port for non-URL targets', () => {
    expect(displayTarget('tcp', '10.0.0.5', 5432)).toBe('10.0.0.5:5432');
  });
});
