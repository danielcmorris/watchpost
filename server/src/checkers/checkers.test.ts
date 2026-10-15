import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from './index.js';

let server: http.Server;
let base: string;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') { res.end('hello world'); }
    else if (req.url === '/slow') { setTimeout(() => res.end('late'), 3000); }
    else { res.statusCode = 500; res.end('boom'); }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); });

const spec = (over: object) => ({ type: 'http', target: base, timeoutS: 2, config: {}, ...over }) as Parameters<typeof runCheck>[0];

describe('http checker', () => {
  it('passes on 200', async () => {
    const r = await runCheck(spec({ target: `${base}/ok` }));
    expect(r.ok).toBe(true);
    expect(r.statusCode).toBe(200);
  });
  it('fails on 500', async () => {
    const r = await runCheck(spec({ target: `${base}/err` }));
    expect(r.ok).toBe(false);
    expect(r.statusCode).toBe(500);
  });
  it('accepts custom expected status', async () => {
    const r = await runCheck(spec({ target: `${base}/err`, config: { expectedStatus: [500] } }));
    expect(r.ok).toBe(true);
  });
  it('times out', async () => {
    const r = await runCheck(spec({ target: `${base}/slow`, timeoutS: 1 }));
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Timed out');
  });
  it('keyword present / absent', async () => {
    const t = `${base}/ok`;
    expect((await runCheck(spec({ type: 'keyword', target: t, config: { keyword: 'hello' } }))).ok).toBe(true);
    expect((await runCheck(spec({ type: 'keyword', target: t, config: { keyword: 'nope' } }))).ok).toBe(false);
    expect((await runCheck(spec({ type: 'keyword', target: t, config: { keyword: 'nope', keywordMode: 'absent' } }))).ok).toBe(true);
    expect((await runCheck(spec({ type: 'keyword', target: t, config: { keyword: 'hello', keywordMode: 'absent' } }))).ok).toBe(false);
  });
});

describe('tcp checker', () => {
  it('connects to open port and fails on closed', async () => {
    expect((await runCheck({ type: 'tcp', target: '127.0.0.1', timeoutS: 2, config: { port } })).ok).toBe(true);
    const closed = await new Promise<number>((res) => {
      const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as AddressInfo).port; s.close(() => res(p)); });
    });
    expect((await runCheck({ type: 'tcp', target: '127.0.0.1', timeoutS: 2, config: { port: closed } })).ok).toBe(false);
  });
});

describe('ping checker', () => {
  it('pings localhost and rejects bad hosts', async () => {
    expect((await runCheck({ type: 'ping', target: '127.0.0.1', timeoutS: 2, config: {} })).ok).toBe(true);
    expect((await runCheck({ type: 'ping', target: '-c9;rm', timeoutS: 2, config: {} })).ok).toBe(false);
  });
});
