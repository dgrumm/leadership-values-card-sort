import { create } from 'zustand';
import type { Event, SessionState } from '@values-cards/shared';

export interface SessionStore {
  state: SessionState | null;
  applyEvent: (event: Event) => void;
}

/**
 * `participants` and `reveals` patches carry the *complete replacement value* for each
 * touched id (see `apply-intent.ts`'s `unreveal`, which sends a whole per-round map
 * minus the deleted round) — so merging one level deep is correct, not a partial-merge
 * guess. Everything else in a patch is already the full new value at that key.
 */
function mergePatch(state: SessionState, patch: Partial<SessionState>): SessionState {
  return {
    ...state,
    ...patch,
    participants: patch.participants ? { ...state.participants, ...patch.participants } : state.participants,
    reveals: patch.reveals ? { ...state.reveals, ...patch.reveals } : state.reveals,
  };
}

/**
 * Factory: one store per session code (tenet — no module-level global store). `state`
 * is `null` until the first `state` event arrives; a `patch` before that is dropped,
 * since the DO always sends a full snapshot before any patch (join/rejoin both do).
 */
export function createSessionStore() {
  return create<SessionStore>((set, get) => ({
    state: null,
    applyEvent: (event) => {
      if (event.type === 'state') {
        set({ state: event.state });
      } else if (event.type === 'patch') {
        const current = get().state;
        if (!current) return;
        set({ state: mergePatch(current, event.patch) });
      }
      // 'nudge' and 'error' are transient, not state — callers observe them via the
      // raw event, not through this store.
    },
  }));
}

export type SessionStoreHook = ReturnType<typeof createSessionStore>;
