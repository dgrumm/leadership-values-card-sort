import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Deck, GameConfig } from '@values-cards/shared';
import { MotionProvider } from '../../theme/motion';
import { CustomDeckPanel } from './custom-deck-panel';

afterEach(cleanup);

const SMALL_DECK = { name: 'Starter', cards: Array.from({ length: 4 }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })) };

function baseConfig(deck: Deck = SMALL_DECK, keep = 8): GameConfig {
  return {
    title: 'Test',
    deck,
    rounds: [{ name: 'Narrow', keep, rank: true }],
    theme: { variant: 'default' },
    facilitated: true,
  };
}

const VALID_CSV = 'Courage,Acting despite fear\nTrust,Confidence in others\nCuriosity,Seeking to understand';

function Fixture({ initialConfig }: { initialConfig: GameConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [isCustom, setIsCustom] = useState(false);
  return (
    <MotionProvider>
      <CustomDeckPanel
        config={config}
        activeCustomDeck={isCustom ? config.deck : null}
        onUse={(deck) => {
          setIsCustom(true);
          setConfig((c) => ({ ...c, deck }));
        }}
        onRemove={() => {
          setIsCustom(false);
          setConfig((c) => ({ ...c, deck: SMALL_DECK }));
        }}
      />
    </MotionProvider>
  );
}

describe('CustomDeckPanel', () => {
  it('labels the textarea and file input', () => {
    render(<Fixture initialConfig={baseConfig()} />);
    expect(screen.getByLabelText(/Paste CSV/)).toBeDefined();
    expect(screen.getByLabelText(/upload a CSV file/)).toBeDefined();
  });

  it('shows a preview with card count and mini cards on valid CSV', () => {
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 2)} />);
    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: VALID_CSV } });
    expect(screen.getByText('3 cards')).toBeDefined();
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use this deck' })).toHaveProperty('disabled', false);
  });

  it('announces parse errors in an alert region', () => {
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 2)} />);
    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: 'Courage,\nTrust,ok' } });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/empty description/);
  });

  it('rejects a deck smaller than the current largest keep-count, naming both numbers', () => {
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 8)} />);
    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: VALID_CSV } });
    expect(screen.getByText(/keeps 8 but the deck has only 3/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use this deck' })).toHaveProperty('disabled', true);
  });

  it('paste and file upload of the same bytes produce the same preview', async () => {
    const user = userEvent.setup();
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 2)} />);

    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: VALID_CSV } });
    const pastedPreview = screen.getByText('3 cards');
    expect(pastedPreview).toBeDefined();

    cleanup();
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 2)} />);
    const file = new File([VALID_CSV], 'my-values.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/upload a CSV file/), file);

    expect(await screen.findByText('3 cards')).toBeDefined();
    expect(screen.getByDisplayValue('my-values')).toBeDefined();
    expect(screen.getByText('Courage')).toBeDefined();
  });

  it('using a valid deck calls onUse with the parsed deck', () => {
    render(<Fixture initialConfig={baseConfig(SMALL_DECK, 2)} />);
    fireEvent.change(screen.getByLabelText(/Paste CSV/), { target: { value: VALID_CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));
    expect(screen.getByText(/Using "Custom deck"/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove custom deck' })).toBeDefined();
  });
});
