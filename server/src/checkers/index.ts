import { checkHttp } from './http.js';
import { checkPing } from './ping.js';
import { checkSsl } from './ssl.js';
import { checkTcp } from './tcp.js';
import type { CheckResult, MonitorSpec } from './types.js';

export type { CheckResult, MonitorSpec } from './types.js';

export function runCheck(m: MonitorSpec): Promise<CheckResult> {
  switch (m.type) {
    case 'http':
    case 'keyword': return checkHttp(m);
    case 'ping': return checkPing(m);
    case 'tcp': return checkTcp(m);
    case 'ssl': return checkSsl(m);
  }
}
