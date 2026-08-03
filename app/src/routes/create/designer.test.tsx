import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Deck, GameConfig } from '@values-cards/shared';
import leadershipForty from '@values-cards/decks/decks/leadership-40.json';
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
    <Designer
      config={config}
      onTitleChange={(title) => setConfig((c) => ({ ...c, title }))}
      onDeckChange={(deck) => setConfig((c) => ({ ...c, deck }))}
      onRoundsChange={(rounds) => setConfig((c) => ({ ...c, rounds }))}
      onFacilitatedChange={(facilitated) => setConfig((c) => ({ ...c, facilitated }))}
    />
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
});
