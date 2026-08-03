import type { RoundConfig } from '../schemas/config.js';
import { shuffle } from './shuffle.js';

/**
 * Engine-level slice of the local per-participant sort state (architecture §4.2).
 * 01.3 owns the full client store (adds `lastAction` for undo); the engine only
 * needs enough to compute the next round and finish-eligibility.
 */
export interface SortState {
  participantId: string;
  round: number;
  queue: string[];
  kept: string[];
  discarded: string[];
  totalDiscarded: number;
  ranking?: string[];
}

/** Kept cards become next round's shuffled queue; the discard counter accumulates. */
export function nextRound(sortState: SortState, config: { rounds: readonly RoundConfig[] }): SortState {
  const round = sortState.round + 1;
  if (round > config.rounds.length) {
    throw new Error(`no round ${round} in this config (only ${config.rounds.length} rounds)`);
  }
  const seed = `${sortState.participantId}:${round}`;
  return {
    participantId: sortState.participantId,
    round,
    queue: shuffle(sortState.kept, seed),
    kept: [],
    discarded: [],
    totalDiscarded: sortState.totalDiscarded + sortState.discarded.length,
  };
}

export type FinishStatus = { ok: true } | { needTrim: number } | { incomplete: true };

/**
 * Whether a round's sort is done, needs trimming down to the keep-count, or
 * isn't finished yet. `incomplete` means only one thing: there are still
 * cards in the queue. Once the queue is empty, keeping fewer than the
 * round's keep-count is a valid outcome (01.4) — over the count needs a
 * trim, at or under it is always `ok`.
 */
export function canFinishRound(sortState: Pick<SortState, 'queue' | 'kept'>, roundCfg: RoundConfig): FinishStatus {
  if (sortState.queue.length > 0) {
    return { incomplete: true };
  }
  if (roundCfg.keep !== 'any' && sortState.kept.length > roundCfg.keep) {
    return { needTrim: sortState.kept.length - roundCfg.keep };
  }
  return { ok: true };
}
