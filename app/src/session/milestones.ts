import type { GameConfig, Progress } from '@values-cards/shared';
import { getPhase, type SortState } from '../stores/createSortStore';

const DEBOUNCE_MS = 500;

/**
 * Counts only (invariant 2) — round, cards processed this round, cards kept this round,
 * and whether the whole game is finished. Never the card ids/values themselves.
 */
export function computeProgress(state: SortState, config: GameConfig): Progress {
  return {
    round: state.round,
    sorted: state.kept.length + state.discarded.length,
    kept: state.kept.length,
    done: getPhase(state, config) === 'result',
  };
}

export interface MilestoneReporter {
  /** Schedules `send` with the latest progress, debounced (trailing) so a swipe burst
   *  collapses into one intent. */
  report: (progress: Progress) => void;
  /** Cancels any pending debounced send (e.g. on unmount). */
  cancel: () => void;
}

/** `send` is fired at most once per `delayMs` of inactivity, always with the *latest*
 *  progress passed to `report` — never an intermediate one. */
export function createMilestoneReporter(send: (progress: Progress) => void, delayMs = DEBOUNCE_MS): MilestoneReporter {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Progress | undefined;

  return {
    report(progress) {
      pending = progress;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending) send(pending);
        pending = undefined;
      }, delayMs);
    },
    cancel() {
      clearTimeout(timer);
      pending = undefined;
    },
  };
}
