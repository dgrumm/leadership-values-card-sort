import { beforeEach, describe, expect, it } from 'vitest';
import type { GameConfig } from '@values-cards/shared';
import { createSortStore, getPhase } from './createSortStore';

function twoRoundConfig(): GameConfig {
  return {
    title: 'Test',
    deck: {
      name: 'Deck',
      cards: Array.from({ length: 5 }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
    },
    rounds: [
      { name: 'Round 1', keep: 3, rank: false },
      { name: 'Round 2', keep: 2, rank: true },
    ],
    theme: { variant: 'default' },
    facilitated: false,
  };
}

/** Keeps the first `keepCount` cards in the queue and discards the rest, so the queue empties. */
function sortRound(store: ReturnType<typeof createSortStore>, keepCount: number) {
  let kept = 0;
  while (store.getState().queue.length > 0) {
    const head = store.getState().queue[0] as string;
    if (kept < keepCount) {
      store.getState().keep(head);
      kept++;
    } else {
      store.getState().discard(head);
    }
  }
}

/** Keeps every remaining card in the queue (used to deliberately over-keep for trim tests). */
function keepAll(store: ReturnType<typeof createSortStore>, count: number) {
  for (let i = 0; i < count; i++) {
    const head = store.getState().queue[0];
    if (head === undefined) return;
    store.getState().keep(head);
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe('round flow wiring', () => {
  it('at/under keep-count with a next round goes straight to round-complete', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 3); // exactly the round-1 keep count, queue now empty
    expect(getPhase(store.getState(), config)).toBe('round-complete');
  });

  it('keeping fewer than the keep-count is allowed — still goes straight to round-complete', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 1); // keep 1, discard the other 4 — well under the round-1 keep-count of 3
    expect(store.getState().kept).toHaveLength(1);
    expect(getPhase(store.getState(), config)).toBe('round-complete');
  });

  it('over the keep-count needs a trim', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    keepAll(store, 5); // deck has 5 cards, round 1 keeps only 3
    expect(store.getState().kept).toHaveLength(5);
    expect(getPhase(store.getState(), config)).toBe('trim');
  });

  it('confirmTrim is a no-op until enough cards are cut (invariant 3)', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    keepAll(store, 5);
    const [a] = store.getState().kept;
    store.getState().toggleCut(a as string); // only 1 of the 2 needed cuts
    store.getState().confirmTrim();
    expect(store.getState().kept).toHaveLength(5); // unchanged — still over limit
    expect(getPhase(store.getState(), config)).toBe('trim');
  });

  it('confirmTrim cuts down to the keep-count and accumulates the discard counter', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    keepAll(store, 5);
    const [a, b] = store.getState().kept;
    store.getState().toggleCut(a as string);
    store.getState().toggleCut(b as string);
    store.getState().confirmTrim();
    const state = store.getState();
    expect(state.kept).toHaveLength(3);
    expect(state.discarded).toEqual(expect.arrayContaining([a, b]));
    expect(getPhase(state, config)).toBe('round-complete');
  });

  it('continueRound refuses to advance while kept is still over the keep-count (invariant 3)', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    keepAll(store, 5); // needs a trim, never confirmed
    store.getState().continueRound();
    expect(store.getState().round).toBe(1); // did not advance
    expect(store.getState().kept).toHaveLength(5);
  });

  it('continueRound advances via the shared engine: kept becomes the reshuffled next-round queue', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 3);
    const keptGoingIn = store.getState().kept;
    store.getState().continueRound();
    const state = store.getState();
    expect(state.round).toBe(2);
    expect(state.kept).toEqual([]);
    expect(state.discarded).toEqual([]);
    expect(new Set(state.queue)).toEqual(new Set(keptGoingIn));
    expect(getPhase(state, config)).toBe('sort');
  });

  it('discard counter accumulates across rounds', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    // Round 1: discard 2, keep 3.
    store.getState().discard(store.getState().queue[0] as string);
    store.getState().discard(store.getState().queue[0] as string);
    keepAll(store, 3);
    expect(store.getState().totalDiscarded).toBe(0); // not yet rolled up
    store.getState().continueRound();
    expect(store.getState().totalDiscarded).toBe(2);

    // Round 2 (final, keep 2 of 3): discard 1.
    store.getState().discard(store.getState().queue[0] as string);
    keepAll(store, 2);
    expect(getPhase(store.getState(), config)).toBe('rank'); // final round, rank: true
  });

  it('final round without rank goes straight to result once at/under the keep-count', () => {
    const config: GameConfig = {
      ...twoRoundConfig(),
      rounds: [{ name: 'Only round', keep: 3, rank: false }],
    };
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 3);
    expect(getPhase(store.getState(), config)).toBe('result');
  });

  it('confirmRank locks in the ranking (defaulting to kept order) and unlocks the result phase', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 3);
    store.getState().continueRound(); // into round 2 (final, rank: true)
    sortRound(store, 2);
    expect(getPhase(store.getState(), config)).toBe('rank');
    const keptOrder = store.getState().kept;
    store.getState().confirmRank();
    const state = store.getState();
    expect(state.ranking).toEqual(keptOrder);
    expect(getPhase(state, config)).toBe('result');
  });

  it('setRanking is respected by confirmRank instead of the default kept order', () => {
    const config = twoRoundConfig();
    const store = createSortStore('CODE1', 'p1', config);
    sortRound(store, 3);
    store.getState().continueRound();
    sortRound(store, 2);
    const reversed = [...store.getState().kept].reverse();
    store.getState().setRanking(reversed);
    store.getState().confirmRank();
    expect(store.getState().ranking).toEqual(reversed);
  });
});
