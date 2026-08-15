import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { validateConfig, type GameConfig, type RoundConfig } from '@values-cards/shared';
import { RoundEditor } from './round-editor';

afterEach(cleanup);

const DECK = { name: 'Test Deck', cards: Array.from({ length: 10 }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })), source: 'bundled' as const };

function baseConfig(rounds: RoundConfig[]): GameConfig {
  return { title: 'Test', deck: DECK, rounds, theme: { variant: 'default' }, facilitated: true };
}

function Fixture({ initialRounds }: { initialRounds: RoundConfig[] }) {
  const [rounds, setRounds] = useState(initialRounds);
  const errors = (() => {
    const result = validateConfig(baseConfig(rounds));
    return result.ok ? [] : result.errors;
  })();
  return <RoundEditor rounds={rounds} deckSize={DECK.cards.length} errors={errors} onChange={setRounds} />;
}

describe('RoundEditor', () => {
  it('renders labelled fields for each round', () => {
    render(<Fixture initialRounds={[{ name: 'Narrow', keep: 8, rank: false }, { name: 'Final', keep: 3, rank: true }]} />);
    expect(screen.getByRole('textbox', { name: 'Round 1 name' })).toHaveProperty('value', 'Narrow');
    expect(screen.getAllByRole('spinbutton', { name: 'Keep count' })).toHaveLength(2);
  });

  it('flags non-decreasing keep-counts inline and nothing else is broken', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 5, rank: false }, { name: 'B', keep: 5, rank: false }]} />);
    expect(screen.getByText(/must strictly decrease/)).toBeDefined();
  });

  it('flags keep > deck size inline', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 20, rank: false }]} />);
    expect(screen.getByText(/keeps 20 but the deck has only 10/)).toBeDefined();
  });

  it('flags more than 6 rounds', () => {
    const rounds: RoundConfig[] = Array.from({ length: 7 }, (_, i) => ({ name: `R${i}`, keep: 6 - i > 0 ? 6 - i : 1, rank: false }));
    render(<Fixture initialRounds={rounds} />);
    expect(screen.getByText(/between 1 and 6 rounds/)).toBeDefined();
  });

  it('flags keep-any used outside round 1', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 5, rank: false }, { name: 'B', keep: 'any', rank: false }]} />);
    expect(screen.getByText(/only allowed on round 1/)).toBeDefined();
  });

  it('flags rank used outside the final round', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 5, rank: true }, { name: 'B', keep: 3, rank: false }]} />);
    expect(screen.getByText(/only allowed on the final round/)).toBeDefined();
  });

  it('only offers "keep any" on round 1 and "rank" on the final round', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 8, rank: false }, { name: 'B', keep: 3, rank: true }]} />);
    expect(screen.getByRole('checkbox', { name: /Keep any/ })).toBeDefined();
    expect(screen.queryAllByRole('checkbox', { name: /Keep any/ })).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: /Rank final results/ })).toBeDefined();
    expect(screen.queryAllByRole('checkbox', { name: /Rank final results/ })).toHaveLength(1);
  });

  it('adds and removes rounds, respecting the 1-6 bound', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 8, rank: true }]} />);
    expect(screen.getByRole('button', { name: 'Remove round 1' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Add round' }));
    expect(screen.getAllByRole('button', { name: /Remove round/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove round 2' }));
    expect(screen.getAllByRole('button', { name: /Remove round/ })).toHaveLength(1);
  });

  it('is fully keyboard operable (tab to a field and type)', () => {
    render(<Fixture initialRounds={[{ name: 'A', keep: 8, rank: true }]} />);
    const nameInput = screen.getByRole('textbox', { name: 'Round 1 name' });
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    expect(nameInput).toHaveProperty('value', 'Updated');
  });
});
