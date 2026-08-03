import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { GameCard, type GameCardSize } from './GameCard';

afterEach(cleanup);

const SIZES: GameCardSize[] = ['sm', 'md', 'lg'];

function renderCard(card: ReactElement) {
  return render(<MotionProvider>{card}</MotionProvider>);
}

describe('GameCard', () => {
  for (const size of SIZES) {
    it(`renders a 5:7 portrait aspect at size=${size}`, () => {
      renderCard(<GameCard title="Courage" size={size} />);
      const card = screen.getByText('Courage').closest('[data-flipped]');
      expect(card?.className).toContain('aspect-[5/7]');
    });
  }

  it('shows the front face with title and description by default', () => {
    renderCard(<GameCard title="Courage" description="Acting despite fear" />);
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.getByText('Acting despite fear')).toBeDefined();
  });

  it('shows the card-back face when flipped, hiding the title', () => {
    renderCard(<GameCard title="Courage" flipped />);
    expect(screen.queryByText('Courage')).toBeNull();
  });
});
