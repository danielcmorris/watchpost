import { describe, expect, it } from 'vitest';
import { nextState } from './state.js';

const base = { status: 'up' as const, consecutiveFailures: 0, failureThreshold: 2 };

describe('nextState', () => {
  it('stays up on a single failure (flap protection)', () => {
    const r = nextState(base, false);
    expect(r).toEqual({ status: 'up', consecutiveFailures: 1, transition: null });
  });
  it('goes down at threshold, once', () => {
    const r1 = nextState({ ...base, consecutiveFailures: 1 }, false);
    expect(r1).toEqual({ status: 'down', consecutiveFailures: 2, transition: 'down' });
    const r2 = nextState({ ...base, status: 'down', consecutiveFailures: 2 }, false);
    expect(r2.transition).toBeNull();
  });
  it('recovers on first success', () => {
    const r = nextState({ ...base, status: 'down', consecutiveFailures: 5 }, true);
    expect(r).toEqual({ status: 'up', consecutiveFailures: 0, transition: 'up' });
  });
  it('pending -> up has no transition', () => {
    expect(nextState({ ...base, status: 'pending' }, true).transition).toBeNull();
  });
  it('pending with threshold 1 goes down immediately', () => {
    expect(nextState({ status: 'pending', consecutiveFailures: 0, failureThreshold: 1 }, false).transition).toBe('down');
  });
  it('success resets failure count', () => {
    expect(nextState({ ...base, consecutiveFailures: 1 }, true).consecutiveFailures).toBe(0);
  });
});
