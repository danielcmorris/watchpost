import { describe, expect, it } from 'vitest';
import { alertEmail, displayTarget, formatDuration } from './emails.js';

const mon = { id: 7, name: 'Billing <API>', type: 'keyword', target: 'https://example.com/health?sid=SECRET', port: undefined };
const base = 'https://status.example.org/';

describe('alertEmail', () => {
  it('links back to the configured base URL', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, reason: 'Timed out', baseUrl: base });
    expect(e.html).toContain('href="https://status.example.org/monitors/7"');
    expect(e.html).toContain('href="https://status.example.org/"');
    expect(e.text).toContain('https://status.example.org/monitors/7');
    expect(e.html).not.toContain('status.example.org//');
  });
  it('escapes HTML in names and reasons', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, reason: '<script>x</script>', baseUrl: base });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('Billing &lt;API&gt;');
  });
  it('never includes query strings from the target', () => {
    const e = alertEmail({ kind: 'down', monitor: mon, baseUrl: base });
    expect(e.html + e.text).not.toContain('SECRET');
    expect(e.text).toContain('https://example.com/health?…');
  });
  it('reports downtime on recovery', () => {
    const e = alertEmail({ kind: 'up', monitor: mon, baseUrl: base, startedAt: new Date('2026-01-01T10:00:00Z'), resolvedAt: new Date('2026-01-01T10:04:10Z') });
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
