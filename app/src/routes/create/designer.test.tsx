import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Deck, GameConfig } from '@values-cards/shared';
import leadershipForty from '@values-cards/decks/decks/leadership-40.json';
import { MotionProvider } from '../../theme/motion';
import { Designer } from './designer';

afterEach(cleanup);

function Fixture() {
  const [config, setConfig] = useState<GameConfig>({
    title: 'Test',
    deck: leadershipForty as Deck,
    // 30 fits Leadership 40 (40 cards) but not Dev 12 (12 cards) — switching
    // decks below must surface that immediately.
    rounds: [
      { name: 'Narrow', keep: 30, rank: false },
      { name: 'Final', keep: 3, rank: true },
    ],
    theme: { variant: 'default' },
    facilitated: true,
  });
  return (
    <MotionProvider>
      <Designer
        config={config}
        onTitleChange={(title) => setConfig((c) => ({ ...c, title }))}
        onDeckChange={(deck) => setConfig((c) => ({ ...c, deck }))}
        onRoundsChange={(rounds) => setConfig((c) => ({ ...c, rounds }))}
        onFacilitatedChange={(facilitated) => setConfig((c) => ({ ...c, facilitated }))}
      />
    </MotionProvider>
  );
}

describe('Designer', () => {
  it('switching to a smaller deck flags now-invalid keep-counts immediately', () => {
    render(<Fixture />);
    expect(screen.queryByText(/keeps 30 but the deck has only/)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Dev 12/ }));

    expect(screen.getByText(/keeps 30 but the deck has only 12/)).toBeDefined();
  });

  it('labels the title field and facilitation toggle', () => {
    render(<Fixture />);
    expect(screen.getByRole('textbox', { name: 'Game title' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: /Facilitation mode/ })).toBeDefined();
  });

  it('using a custom deck updates the deck picker (no bundled radio checked) and reruns the keep-count check', () => {
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText(/Paste CSV/), {
      target: { value: 'A,a\nB,b\nC,c' },
    });
    // 3 cards is smaller than round 1's keep of 30 — the shared KEEP_EXCEEDS_DECK_SIZE
    // rule fires immediately, inside the custom-deck panel itself.
    expect(screen.getByText(/keeps 30 but the deck has only 3/)).toBeDefined();

    // Shrink the round instead, then commit the custom deck.
    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'Keep count' })[0] as HTMLElement, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));

    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.getByText(/Using "Custom deck"/)).toBeDefined();
  });

  it('removing a custom deck reverts to the previously selected bundled deck', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('radio', { name: /Extended 72/ }));

    // Large enough (40 cards) that it never trips the base fixture's keep-counts (30, 3).
    const csv = Array.from({ length: 40 }, (_, i) => `Card ${i},Desc ${i}`).join('\n');
    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: csv } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));
    expect(screen.getByRole('button', { name: 'Remove custom deck' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Remove custom deck' }));
    expect(screen.getByRole('radio', { name: /Extended 72/ })).toHaveProperty('checked', true);
  });
});
