/**
 * Connection state machine (architecture §5):
 * `connecting → live → reconnecting → resumed | expired`.
 *
 * Pure reducer — no timers, no sockets — so every transition is a plain unit test.
 * `expired` is terminal: once the DO tells us the code is gone, nothing recovers it.
 */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'resumed' | 'expired';

export type ConnectionAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'error'; code: string }
  /** A full `state` event arrived (the DO's answer to a `rejoin`). */
  | { type: 'state' }
  /** The `resumed` snapshot has been applied; settle back into `live`. */
  | { type: 'settled' };

export function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
  if (state === 'expired') return state;

  switch (action.type) {
    case 'open':
      return state === 'connecting' ? 'live' : state;
    case 'close':
      return 'reconnecting';
    case 'error':
      return action.code === 'expired' || action.code === 'not_found' ? 'expired' : state;
    case 'state':
      return state === 'reconnecting' ? 'resumed' : state;
    case 'settled':
      return state === 'resumed' ? 'live' : state;
  }
}

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;

/** Exponential backoff (0.5s → 8s cap) with full jitter, keyed by 0-indexed attempt number. */
export function backoffDelay(attempt: number): number {
  const cap = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return cap / 2 + Math.random() * (cap / 2);
}
