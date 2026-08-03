import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameConfig } from '@values-cards/shared';
import { createSortStore } from '../stores/createSortStore';
import { MotionProvider } from '../theme/motion';
import { SortRound } from './SortRound';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function config(count: number, keep: number | 'any' = 1): GameConfig {
  return {
    title: 'Test',
    deck: {
      name: 'Deck',
      cards: Array.from({ length: count }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
    },
    rounds: [{ name: 'Round 1', keep, rank: false }],
    theme: { variant: 'default' },
    facilitated: false,
  };
}

function renderRound(cfg: GameConfig) {
  const useSortStore = createSortStore('TEST01', 'participant-1', cfg);
  render(
    <MotionProvider>
      <SortRound config={cfg} useSortStore={useSortStore} />
    </MotionProvider>,
  );
  return useSortStore;
}

describe('SortRound', () => {
  it('shows the round name and position in the deck', () => {
    renderRound(config(3));
    expect(screen.getByText('Round 1 · 1 of 3')).toBeDefined();
  });

  it('announces keep actions with a running count via aria-live', async () => {
    const cfg = config(3, 2);
    const useSortStore = renderRound(cfg);
    const first = useSortStore.getState().queue[0] as string;
    await userEvent.click(screen.getByRole('button', { name: `Keep ${first}` }));
    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe(`Kept ${first}, 1 of 2`));
  });

  it('announces discard actions', async () => {
    const cfg = config(3, 2);
    const useSortStore = renderRound(cfg);
    const first = useSortStore.getState().queue[0] as string;
    await userEvent.click(screen.getByRole('button', { name: `Discard ${first}` }));
    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe(`Discarded ${first}`));
  });

  it('shows the "Round complete" placeholder once the queue empties', async () => {
    const cfg = config(1, 1);
    renderRound(cfg);
    const cardValue = 'Card 0';
    await userEvent.click(screen.getByRole('button', { name: `Keep ${cardValue}` }));
    await waitFor(() => expect(screen.getByText('Round complete')).toBeDefined(), { timeout: 3000 });
  });
});
