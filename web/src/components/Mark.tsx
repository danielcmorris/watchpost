import type { CSSProperties } from 'react';

export type State = 'up' | 'down' | 'paused' | 'pending';

/** The lantern on its post. The lamp takes the colour of the current state. */
export function Mark({ state = 'up', size = 26 }: { state?: State; size?: number }) {
  const lamp = state === 'down' ? 'var(--down)' : state === 'up' ? 'var(--up)' : 'var(--muted)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="9" rx="2.2" />
      <circle cx="12" cy="7" r="2.2" fill={lamp} stroke="none" />
      <path d="M12 11.5V21.5M8 21.5h8" />
    </svg>
  );
}

const LABEL: Record<State, string> = { up: 'Up', down: 'Down', paused: 'Paused', pending: 'Waiting for first check' };

/** Status as a shape as well as a colour: circle = up, diamond = down, ring = paused / pending. */
export function Status({ state, size = 12 }: { state: State; size?: number }) {
  const style: CSSProperties = { flex: 'none' };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} role="img" aria-label={LABEL[state]}>
      <title>{LABEL[state]}</title>
      {state === 'up' && <circle cx="6" cy="6" r="5" fill="var(--up)" />}
      {state === 'down' && <rect x="2" y="2" width="8" height="8" rx="1" transform="rotate(45 6 6)" fill="var(--down)" />}
      {(state === 'paused' || state === 'pending') && <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--muted)" strokeWidth="1.6" />}
    </svg>
  );
}

export function stateOf(m: { status: string; paused: boolean }): State {
  return m.paused ? 'paused' : (m.status as State);
}

/** The most recent checks: short ticks passed, tall red ticks failed. */
export function Ticks({ values, count = 40 }: { values: boolean[]; count?: number }) {
  const padded = [...Array<null>(Math.max(0, count - values.length)).fill(null), ...values.slice(-count)];
  return (
    <div className="ticks" role="img" aria-label={`Last ${values.length} checks: ${values.filter((v) => !v).length} failed`}>
      {padded.map((v, i) => <span key={i} className={v === null ? 'none' : v ? 'ok' : 'bad'} />)}
    </div>
  );
}
