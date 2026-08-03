import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { canFinishRound, nextRound, shuffle, type GameConfig } from '@values-cards/shared';

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
  /** Cards discarded in *previous* rounds — the current round's `discarded` is added in on `continueRound` (01.4). */
  totalDiscarded: number;
  /** Kept cards marked to cut in TrimGrid, pending `confirmTrim` (01.4). */
  cut: string[];
  /** Final-round order from RankBoard; locked in once `confirmRank` runs (01.4). */
  ranking?: string[];
  rankConfirmed: boolean;
  lastAction?: SortAction;
}

export type SortPhase = 'sort' | 'round-complete' | 'trim' | 'rank' | 'result';

/**
 * Derives where the flow is from state + config alone — no separate phase
 * field to fall out of sync on refresh (round.ts's `canFinishRound` is the
 * single source of truth for round completion; the same 40->8->3 shape or
 * any other config drives this without per-round special-casing).
 */
export function getPhase(
  state: Pick<SortState, 'round' | 'queue' | 'kept' | 'rankConfirmed'>,
  config: GameConfig,
): SortPhase {
  const roundCfg = config.rounds[state.round - 1];
  if (!roundCfg) return 'result';
  const status = canFinishRound(state, roundCfg);
  if ('incomplete' in status) return 'sort';
  if ('needTrim' in status) return 'trim';
  const isLastRound = state.round >= config.rounds.length;
  if (!isLastRound) return 'round-complete';
  if (roundCfg.rank && !state.rankConfirmed) return 'rank';
  return 'result';
}

export interface SortStore extends SortState {
  keep: (cardId: string) => void;
  discard: (cardId: string) => void;
  undo: () => void;
  demote: (cardId: string) => void;
  /** Toggle a kept card as cut in TrimGrid. */
  toggleCut: (cardId: string) => void;
  /** Moves cut cards into `discarded`. No-op unless cutting enough clears the keep-count (invariant 3). */
  confirmTrim: () => void;
  /** Advances to the next round via the shared engine. No-op unless the round can actually finish. */
  continueRound: () => void;
  setRanking: (order: string[]) => void;
  /** Locks in the final order (defaulting to kept order if the board was never touched). */
  confirmRank: () => void;
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
        totalDiscarded: 0,
        cut: [],
        rankConfirmed: false,

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

        toggleCut: (cardId) => {
          const state = get();
          if (!state.kept.includes(cardId)) return;
          set({
            cut: state.cut.includes(cardId)
              ? state.cut.filter((id) => id !== cardId)
              : [...state.cut, cardId],
          });
        },

        confirmTrim: () => {
          const state = get();
          const roundCfg = config.rounds[state.round - 1];
          if (!roundCfg || roundCfg.keep === 'any') return;
          // Invariant 3 (client half): never drop cards into `discarded` unless
          // that actually clears the keep-count.
          if (state.kept.length - state.cut.length > roundCfg.keep) return;
          set({
            kept: state.kept.filter((id) => !state.cut.includes(id)),
            discarded: [...state.discarded, ...state.cut],
            cut: [],
          });
        },

        continueRound: () => {
          const state = get();
          const roundCfg = config.rounds[state.round - 1];
          if (!roundCfg || state.round >= config.rounds.length) return;
          const status = canFinishRound(state, roundCfg);
          if (!('ok' in status)) return;
          const next = nextRound(
            {
              participantId,
              round: state.round,
              queue: state.queue,
              kept: state.kept,
              discarded: state.discarded,
              totalDiscarded: state.totalDiscarded,
            },
            config,
          );
          set({
            round: next.round,
            queue: next.queue,
            kept: next.kept,
            discarded: next.discarded,
            totalDiscarded: next.totalDiscarded,
            cut: [],
            ranking: undefined,
            rankConfirmed: false,
            lastAction: undefined,
          });
        },

        setRanking: (order) => set({ ranking: order }),

        confirmRank: () => {
          const state = get();
          set({ ranking: state.ranking ?? state.kept, rankConfirmed: true });
        },
      }),
      { name: `vc:${sessionCode}:${participantId}:sort` },
    ),
  );
}

export type SortStoreHook = ReturnType<typeof createSortStore>;
