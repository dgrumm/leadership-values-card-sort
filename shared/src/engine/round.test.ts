import { describe, expect, it } from 'vitest';
import type { RoundConfig } from '../schemas/config.js';
import { canFinishRound, nextRound, type SortState } from './round.js';

function state(overrides: Partial<SortState> = {}): SortState {
  return {
    participantId: 'p1',
    round: 1,
    queue: [],
    kept: [],
    discarded: [],
    totalDiscarded: 0,
    ...overrides,
  };
}

describe('canFinishRound', () => {
  const roundCfg: RoundConfig = { name: 'Round 1', keep: 3, rank: false };

  it('is incomplete whenever the queue still has cards, regardless of kept count', () => {
    expect(canFinishRound(state({ queue: ['a'], kept: ['b', 'c', 'd'] }), roundCfg)).toEqual({ incomplete: true });
  });

  it('needs a trim when kept exceeds the keep-count and the queue is empty', () => {
    expect(canFinishRound(state({ kept: ['a', 'b', 'c', 'd'] }), roundCfg)).toEqual({ needTrim: 1 });
  });

  it('is ok at exactly the keep-count', () => {
    expect(canFinishRound(state({ kept: ['a', 'b', 'c'] }), roundCfg)).toEqual({ ok: true });
  });

  // 01.4: keeping fewer than the round's keep-count is a valid outcome once
  // the queue is empty — there's nothing left to decide on, so this is not
  // "incomplete". Continue is enabled whenever kept <= N.
  it('is ok under the keep-count once the queue is empty', () => {
    expect(canFinishRound(state({ kept: ['a'] }), roundCfg)).toEqual({ ok: true });
    expect(canFinishRound(state({ kept: [] }), roundCfg)).toEqual({ ok: true });
  });

  it("keep: 'any' is always ok once the queue is empty, no matter how many are kept", () => {
    const anyRound: RoundConfig = { name: 'Round 1', keep: 'any', rank: false };
    expect(canFinishRound(state({ kept: [] }), anyRound)).toEqual({ ok: true });
    expect(canFinishRound(state({ kept: ['a', 'b', 'c', 'd', 'e'] }), anyRound)).toEqual({ ok: true });
  });
});

describe('nextRound', () => {
  const config = { rounds: [{ name: 'Round 1', keep: 3, rank: false } as RoundConfig, { name: 'Round 2', keep: 1, rank: true }] };

  it('reshuffles kept into the next round queue and rolls up the discard count', () => {
    const current = state({ round: 1, kept: ['a', 'b'], discarded: ['c', 'd'], totalDiscarded: 5 });
    const next = nextRound(current, config);
    expect(next.round).toBe(2);
    expect(next.kept).toEqual([]);
    expect(next.discarded).toEqual([]);
    expect(next.totalDiscarded).toBe(7);
    expect(new Set(next.queue)).toEqual(new Set(['a', 'b']));
  });

  it('throws when there is no next round in the config', () => {
    const current = state({ round: 2, kept: ['a'] });
    expect(() => nextRound(current, config)).toThrow(/no round 3/);
  });
});
