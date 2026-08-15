import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameConfig } from '@values-cards/shared';
import { computeProgress, createMilestoneReporter } from './milestones';
import { createSortStore } from '../stores/createSortStore';

function config(): GameConfig {
  return {
    title: 'Test',
    deck: {
      name: 'Deck',
      cards: Array.from({ length: 10 }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
      source: 'bundled',
    },
    rounds: [{ name: 'Round 1', keep: 10, rank: false }],
    theme: { variant: 'default' },
    facilitated: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createMilestoneReporter', () => {
  it('collapses a rapid burst into a single send with the final counts', () => {
    const send = vi.fn();
    const reporter = createMilestoneReporter(send, 500);

    for (let i = 1; i <= 10; i++) {
      reporter.report({ round: 1, sorted: i, kept: i, done: false });
      vi.advanceTimersByTime(50); // faster than the 500ms trailing window
    }

    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ round: 1, sorted: 10, kept: 10, done: false });
  });

  it('sends again after a quiet period followed by more activity', () => {
    const send = vi.fn();
    const reporter = createMilestoneReporter(send, 500);

    reporter.report({ round: 1, sorted: 1, kept: 1, done: false });
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(1);

    reporter.report({ round: 1, sorted: 2, kept: 2, done: false });
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('cancel drops a pending send', () => {
    const send = vi.fn();
    const reporter = createMilestoneReporter(send, 500);
    reporter.report({ round: 1, sorted: 1, kept: 1, done: false });
    reporter.cancel();
    vi.advanceTimersByTime(500);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('computeProgress', () => {
  it('reports counts only — never card ids/values', () => {
    const cfg = config();
    const store = createSortStore('CODE01', 'participant-1', cfg);
    store.getState().keep(store.getState().queue[0] as string);
    store.getState().keep(store.getState().queue[0] as string);
    store.getState().discard(store.getState().queue[0] as string);

    const progress = computeProgress(store.getState(), cfg);
    expect(progress).toEqual({ round: 1, sorted: 3, kept: 2, done: false });
    expect(Object.values(progress).some((v) => typeof v === 'string')).toBe(false);
  });

  it('marks done once the round (and game) is complete', () => {
    const cfg = config();
    const store = createSortStore('CODE02', 'participant-2', cfg);
    while (store.getState().queue.length > 0) {
      store.getState().keep(store.getState().queue[0] as string);
    }

    const progress = computeProgress(store.getState(), cfg);
    expect(progress.done).toBe(true);
  });
});
