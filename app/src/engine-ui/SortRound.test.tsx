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
      source: 'bundled',
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

/**
 * A fresh round opens face-down (01.5), so anything asserting on the sorting
 * controls has to begin the round first — the same step a participant takes.
 */
async function turnOverFirstCard() {
  await userEvent.click(screen.getByRole('button', { name: 'Turn over' }));
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
    await turnOverFirstCard();
    await userEvent.click(screen.getByRole('button', { name: `Keep ${first}` }));
    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe(`Kept ${first}, 1 of 2`));
  });

  it('announces discard actions', async () => {
    const cfg = config(3, 2);
    const useSortStore = renderRound(cfg);
    const first = useSortStore.getState().queue[0] as string;
    await turnOverFirstCard();
    await userEvent.click(screen.getByRole('button', { name: `Discard ${first}` }));
    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe(`Discarded ${first}`));
  });

  it('renders no card once the queue empties — 01.4 (routes/Sort) owns what comes next', async () => {
    const cfg = config(1, 1);
    renderRound(cfg);
    const cardValue = 'Card 0';
    await turnOverFirstCard();
    await userEvent.click(screen.getByRole('button', { name: `Keep ${cardValue}` }));
    await waitFor(() => expect(screen.queryByRole('group', { name: `${cardValue} card` })).toBeNull(), {
      timeout: 3000,
    });
    expect(screen.queryByRole('button', { name: /^Keep /, hidden: true })).toBeNull();
  });
});
