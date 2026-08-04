import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { GameCard } from './GameCard';

afterEach(cleanup);

function renderCard(card: ReactElement) {
  return render(<MotionProvider>{card}</MotionProvider>);
}

describe('GameCard', () => {
  it('renders one canonical 5:7 portrait size, with no size prop', () => {
    renderCard(<GameCard title="Courage" />);
    const card = screen.getByText('Courage').closest('[data-flipped]');
    expect(card?.className).toContain('aspect-[5/7]');
    expect(card?.className).toContain('w-[min(78vw,16rem)]');
  });

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
