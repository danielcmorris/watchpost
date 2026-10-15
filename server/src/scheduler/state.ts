export type Status = 'pending' | 'up' | 'down';

export interface StateIn {
  status: Status;
  consecutiveFailures: number;
  failureThreshold: number;
}

export interface StateOut {
  status: Status;
  consecutiveFailures: number;
  /** 'down' = open incident + alert, 'up' = resolve + alert, null = no change. */
  transition: 'down' | 'up' | null;
}

/** Monitor goes DOWN after `failureThreshold` consecutive failures; UP on first success. */
export function nextState(s: StateIn, ok: boolean): StateOut {
  if (ok) {
    return { status: 'up', consecutiveFailures: 0, transition: s.status === 'down' ? 'up' : null };
  }
  const failures = s.consecutiveFailures + 1;
  if (failures >= s.failureThreshold) {
    return { status: 'down', consecutiveFailures: failures, transition: s.status === 'down' ? null : 'down' };
  }
  return { status: s.status, consecutiveFailures: failures, transition: null };
}
