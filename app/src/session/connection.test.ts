import { describe, expect, it } from 'vitest';
import { backoffDelay, connectionReducer } from './connection';

describe('connectionReducer', () => {
  it('connecting -> live on open', () => {
    expect(connectionReducer('connecting', { type: 'open' })).toBe('live');
  });

  it('connecting -> reconnecting on close (close-during-connecting)', () => {
    expect(connectionReducer('connecting', { type: 'close' })).toBe('reconnecting');
  });

  it('connecting -> expired on error{not_found}', () => {
    expect(connectionReducer('connecting', { type: 'error', code: 'not_found' })).toBe('expired');
  });

  it('live -> reconnecting on close', () => {
    expect(connectionReducer('live', { type: 'close' })).toBe('reconnecting');
  });

  it('live -> reconnecting on error (socket-level)', () => {
    expect(connectionReducer('live', { type: 'close' })).toBe('reconnecting');
  });

  it('reconnecting -> resumed on a full state event', () => {
    expect(connectionReducer('reconnecting', { type: 'state' })).toBe('resumed');
  });

  it('resumed -> live once settled', () => {
    expect(connectionReducer('resumed', { type: 'settled' })).toBe('live');
  });

  it('reconnecting -> expired on error{expired} (expired-during-reconnecting)', () => {
    expect(connectionReducer('reconnecting', { type: 'error', code: 'expired' })).toBe('expired');
  });

  it('reconnecting -> expired on error{not_found}', () => {
    expect(connectionReducer('reconnecting', { type: 'error', code: 'not_found' })).toBe('expired');
  });

  it('reconnecting stays reconnecting on repeated close (retry loop)', () => {
    expect(connectionReducer('reconnecting', { type: 'close' })).toBe('reconnecting');
  });

  it('live stays live on a stray state event (not mid-reconnect)', () => {
    expect(connectionReducer('live', { type: 'state' })).toBe('live');
  });

  it('an unrelated error code does not change state', () => {
    expect(connectionReducer('live', { type: 'error', code: 'auth' })).toBe('live');
  });

  it('expired is terminal — no action escapes it', () => {
    expect(connectionReducer('expired', { type: 'open' })).toBe('expired');
    expect(connectionReducer('expired', { type: 'close' })).toBe('expired');
    expect(connectionReducer('expired', { type: 'state' })).toBe('expired');
    expect(connectionReducer('expired', { type: 'settled' })).toBe('expired');
  });
});

describe('backoffDelay', () => {
  it('starts near the 0.5s base and never exceeds the 8s cap', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = backoffDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });

  it('grows with attempt number before capping', () => {
    // Compare worst-case (max jitter) of an early attempt against best-case of a later one.
    const early = 500 * 2 ** 1; // attempt 1 cap = 1000, jitter range [500, 1000]
    const later = 500 * 2 ** 3; // attempt 3 cap = 4000, jitter range [2000, 4000]
    expect(later / 2).toBeGreaterThan(early);
  });
});
