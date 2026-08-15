import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { GameCard, flipTarget } from './GameCard';

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

  // 01.5 — the two-face flip. The back is always mounted (it is the face that
  // must be present *during* the turn); the front is mounted only face-up, so a
  // face-down card carries no front-face content at all.
  it('keeps the back face mounted and pre-rotated in both states', () => {
    const { unmount } = renderCard(<GameCard title="Courage" />);
    const faceUpBack = screen.getByTestId('card-back');
    expect(faceUpBack.style.transform).toBe('rotateY(180deg)');
    expect(faceUpBack.className).toContain('card-face');
    unmount();

    renderCard(<GameCard title="Courage" flipped />);
    expect(screen.getByTestId('card-back').style.transform).toBe('rotateY(180deg)');
  });

  it('mounts the front face only when face-up, so a face-down card cannot be read', () => {
    const { unmount } = renderCard(<GameCard title="Courage" description="Acting despite fear" />);
    expect(screen.queryByTestId('card-front')).not.toBeNull();
    unmount();

    renderCard(<GameCard title="Courage" description="Acting despite fear" flipped />);
    expect(screen.queryByTestId('card-front')).toBeNull();
    expect(screen.queryByText('Acting despite fear')).toBeNull();
  });

  it('mounts on the face `initialFace` names, not the one `flipped` targets', () => {
    // The bug this guards: a deck card remounts with `flipped` already false, so
    // deriving the start face from `flipped` animates front-to-front — a face
    // swap with no rotation. `initialFace` separates "where it starts" from
    // "where it is going". The rotation itself is asserted in e2e/sort-flip.
    renderCard(<GameCard title="Courage" flipped={false} initialFace="back" />);
    const rotating = screen.getByText('Courage').closest('[data-flipped]') as HTMLElement;
    // Mounted face-down (rotated), while still targeting the front.
    expect(rotating.getAttribute('data-flipped')).toBe('false');
    expect(rotating.style.transform).toContain('rotateY(180deg)');
  });

  it('gives the flip a 3D context so the face swap lands at the 90° midpoint', () => {
    renderCard(<GameCard title="Courage" />);
    const rotating = screen.getByText('Courage').closest('[data-flipped]') as HTMLElement;
    expect(rotating.style.transformStyle).toBe('preserve-3d');
    expect((rotating.parentElement as HTMLElement).style.perspective).toBe('var(--card-perspective)');
  });
});

describe('flipTarget', () => {
  it('is unrotated when face-up, whichever direction is passed', () => {
    expect(flipTarget(false, 'left')).toEqual({ rotateY: 0 });
    expect(flipTarget(false, 'right')).toEqual({ rotateY: 0 });
  });

  it('inverts the rotation sign so the leading edge follows the direction', () => {
    expect(flipTarget(true, 'right').rotateY).toBe(180);
    expect(flipTarget(true, 'left').rotateY).toBe(-180);
    expect(flipTarget(true, 'right').rotateY).toBe(-flipTarget(true, 'left').rotateY);
  });

  it('defaults to the keep-side direction', () => {
    expect(flipTarget(true)).toEqual(flipTarget(true, 'right'));
  });
});
