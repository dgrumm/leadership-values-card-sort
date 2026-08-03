import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shuffle, type GameConfig } from '@values-cards/shared';

/**
 * Local per-participant sort state (architecture §4.2). Card IDs are the
 * deck's `card.value` — `DeckSchema` already enforces value uniqueness, so
 * no separate ID scheme is needed.
 */
export interface SortAction {
  type: 'keep' | 'discard' | 'demote';
  cardId: string;
  /** demote only: index in `kept` to restore on undo. */
  fromIndex?: number;
}

export interface SortState {
  round: number;
  queue: string[];
  kept: string[];
  discarded: string[];
  lastAction?: SortAction;
  ranking?: string[];
}

export interface SortStore extends SortState {
  keep: (cardId: string) => void;
  discard: (cardId: string) => void;
  undo: () => void;
  demote: (cardId: string) => void;
}

function initialQueue(config: GameConfig, participantId: string, round: number): string[] {
  return shuffle(
    config.deck.cards.map((card) => card.value),
    `${participantId}:${round}`,
  );
}

/**
 * Factory: one store per (session, participant). Persisted to localStorage
 * so a refresh mid-round restores exact progress (PRD invariant 4). Round
 * advancement (01.4) isn't wired here — the store always starts at round 1.
 */
export function createSortStore(sessionCode: string, participantId: string, config: GameConfig) {
  return create<SortStore>()(
    persist(
      (set, get) => ({
        round: 1,
        queue: initialQueue(config, participantId, 1),
        kept: [],
        discarded: [],

        keep: (cardId) => {
          const state = get();
          if (state.queue[0] !== cardId) return;
          set({
            queue: state.queue.slice(1),
            kept: [...state.kept, cardId],
            lastAction: { type: 'keep', cardId },
          });
        },

        discard: (cardId) => {
          const state = get();
          if (state.queue[0] !== cardId) return;
          set({
            queue: state.queue.slice(1),
            discarded: [...state.discarded, cardId],
            lastAction: { type: 'discard', cardId },
          });
        },

        demote: (cardId) => {
          const state = get();
          const index = state.kept.indexOf(cardId);
          if (index === -1) return;
          const kept = [...state.kept];
          kept.splice(index, 1);
          set({
            kept,
            queue: [...state.queue, cardId],
            lastAction: { type: 'demote', cardId, fromIndex: index },
          });
        },

        undo: () => {
          const state = get();
          const action = state.lastAction;
          if (!action) return;
          if (action.type === 'keep') {
            set({
              kept: state.kept.filter((id) => id !== action.cardId),
              queue: [action.cardId, ...state.queue],
              lastAction: undefined,
            });
          } else if (action.type === 'discard') {
            set({
              discarded: state.discarded.filter((id) => id !== action.cardId),
              queue: [action.cardId, ...state.queue],
              lastAction: undefined,
            });
          } else {
            const queue = state.queue.filter((id) => id !== action.cardId);
            const kept = [...state.kept];
            kept.splice(action.fromIndex ?? kept.length, 0, action.cardId);
            set({ queue, kept, lastAction: undefined });
          }
        },
      }),
      { name: `vc:${sessionCode}:${participantId}:sort` },
    ),
  );
}

export type SortStoreHook = ReturnType<typeof createSortStore>;
