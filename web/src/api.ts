export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : 'Request failed');
  return data as T;
}

export interface Monitor {
  id: number; name: string; type: 'http' | 'keyword' | 'ping' | 'tcp' | 'ssl'; target: string;
  interval_s: number; timeout_s: number; failure_threshold: number;
  config: { expectedStatus?: number[]; keyword?: string; keywordMode?: 'present' | 'absent'; port?: number; sslWarnDays?: number };
  status: 'pending' | 'up' | 'down'; paused: boolean; last_check_at: string | null;
  uptime_24h: number | null; last_latency_ms: number | null; contact_ids: number[]; recent: boolean[];
}
export interface Contact { id: number; name: string; email: string }
export interface StatusPage { id: number; slug: string; title: string; monitor_ids: number[] }
