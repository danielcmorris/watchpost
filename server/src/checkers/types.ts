export interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
  /** Days until certificate expiry (ssl checks / https monitors). */
  sslDaysLeft?: number;
}

export interface MonitorSpec {
  type: 'http' | 'keyword' | 'ping' | 'tcp' | 'ssl';
  target: string;
  timeoutS: number;
  config: {
    expectedStatus?: number[];
    keyword?: string;
    keywordMode?: 'present' | 'absent';
    port?: number;
    sslWarnDays?: number;
  };
}
