import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { SwipeCard, swipeExitTarget } from './SwipeCard';

afterEach(cleanup);

const CARD = { value: 'Courage', description: 'Acting despite fear' };

function renderCard(onKeep: () => void, onDiscard: () => void) {
  return render(
    <MotionProvider>
      <SwipeCard card={CARD} onKeep={onKeep} onDiscard={onDiscard} />
    </MotionProvider>,
  );
}

describe('swipeExitTarget', () => {
  it('flies off-screen on the committed side when motion-safe', () => {
    expect(swipeExitTarget('keep', true).x).toBeGreaterThan(0);
    expect(swipeExitTarget('discard', true).x).toBeLessThan(0);
  });

  it('has no x-translation under reduced motion — commit is a fade only', () => {
    expect(swipeExitTarget('keep', false)).toEqual({ x: 0, opacity: 0 });
    expect(swipeExitTarget('discard', false)).toEqual({ x: 0, opacity: 0 });
  });
});

describe('SwipeCard tap path', () => {
  it('tapping the keep (✓) button commits a keep', async () => {
    const onKeep = vi.fn();
    const onDiscard = vi.fn();
    renderCard(onKeep, onDiscard);
    await userEvent.click(screen.getByRole('button', { name: 'Keep Courage' }));
    await waitFor(() => expect(onKeep).toHaveBeenCalled(), { timeout: 3000 });
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('tapping the discard (✗) button commits a discard', async () => {
    const onKeep = vi.fn();
    const onDiscard = vi.fn();
    renderCard(onKeep, onDiscard);
    await userEvent.click(screen.getByRole('button', { name: 'Discard Courage' }));
    await waitFor(() => expect(onDiscard).toHaveBeenCalled(), { timeout: 3000 });
    expect(onKeep).not.toHaveBeenCalled();
  });
});

describe('SwipeCard keyboard path', () => {
  it('ArrowRight commits a keep', async () => {
    const onKeep = vi.fn();
    const onDiscard = vi.fn();
    renderCard(onKeep, onDiscard);
    const group = screen.getByRole('group', { name: 'Courage card' });
    group.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(onKeep).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('ArrowLeft commits a discard', async () => {
    const onKeep = vi.fn();
    const onDiscard = vi.fn();
    renderCard(onKeep, onDiscard);
    const group = screen.getByRole('group', { name: 'Courage card' });
    group.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(onDiscard).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('does not autofocus the card group on mount (no ring on initial load)', () => {
    renderCard(vi.fn(), vi.fn());
    expect(document.activeElement).not.toBe(screen.getByRole('group', { name: 'Courage card' }));
  });
});
