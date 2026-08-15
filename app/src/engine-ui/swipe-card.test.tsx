import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { SwipeCard, flipFromCommit, swipeExitTarget } from './SwipeCard';

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

describe('flipFromCommit', () => {
  it('maps the decision to the direction the next card turns from', () => {
    expect(flipFromCommit('keep')).toBe('right');
    expect(flipFromCommit('discard')).toBe('left');
  });
});

describe('SwipeCard face-down state (01.5)', () => {
  function renderFaceDown(overrides: Partial<Parameters<typeof SwipeCard>[0]> = {}) {
    const props = {
      card: CARD,
      onKeep: vi.fn(),
      onDiscard: vi.fn(),
      revealed: false,
      onReveal: vi.fn(),
      ...overrides,
    };
    render(
      <MotionProvider>
        <SwipeCard {...props} />
      </MotionProvider>,
    );
    return props;
  }

  it('keeps the value in the accessible name while face-down', () => {
    renderFaceDown();
    // The flip is a visual affordance; it must never hide the card from
    // assistive tech.
    expect(screen.getByRole('group', { name: 'Courage card' })).toBeDefined();
  });

  it('renders no front-face content while face-down', () => {
    renderFaceDown();
    expect(screen.queryByText('Courage')).toBeNull();
    expect(screen.queryByText('Acting despite fear')).toBeNull();
  });

  it('offers a turn-over control instead of the keep/discard pair', () => {
    renderFaceDown();
    expect(screen.getByRole('button', { name: 'Turn over' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Keep Courage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard Courage' })).toBeNull();
  });

  it('ignores ArrowRight/ArrowLeft until turned over', async () => {
    const props = renderFaceDown();
    const group = screen.getByRole('group', { name: 'Courage card' });
    group.focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(props.onKeep).not.toHaveBeenCalled();
    expect(props.onDiscard).not.toHaveBeenCalled();
  });

  it('turns over on Enter, Space, and a tap — keyboard is never second-class', async () => {
    const onReveal = vi.fn();
    renderFaceDown({ onReveal });
    const group = screen.getByRole('group', { name: 'Courage card' });
    group.focus();
    await userEvent.keyboard('{Enter}');
    expect(onReveal).toHaveBeenCalledTimes(1);

    group.focus();
    await userEvent.keyboard(' ');
    expect(onReveal).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole('button', { name: 'Turn over' }));
    expect(onReveal).toHaveBeenCalledTimes(3);
  });
});

describe('SwipeCard commit sequencing (01.5)', () => {
  it('fires onCommitStart before the commit resolves, so the next card can flip during the exit', async () => {
    const calls: string[] = [];
    render(
      <MotionProvider>
        <SwipeCard
          card={CARD}
          onCommitStart={(direction) => calls.push(`start:${direction}`)}
          onKeep={() => calls.push('keep')}
          onDiscard={() => calls.push('discard')}
        />
      </MotionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep Courage' }));
    await waitFor(() => expect(calls).toContain('keep'), { timeout: 3000 });
    expect(calls).toEqual(['start:keep', 'keep']);
  });

  it('is not re-entrant: a second commit mid-exit does not count the card twice', async () => {
    const onKeep = vi.fn();
    render(
      <MotionProvider>
        <SwipeCard card={CARD} onKeep={onKeep} onDiscard={vi.fn()} />
      </MotionProvider>,
    );
    const group = screen.getByRole('group', { name: 'Courage card' });
    group.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(onKeep).toHaveBeenCalled(), { timeout: 3000 });
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});
