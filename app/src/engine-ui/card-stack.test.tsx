import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { CardStack } from './CardStack';

afterEach(cleanup);

const CARD = { value: 'Courage', description: 'Acting despite fear' };
const NEXT = { value: 'Curiosity', description: 'Seeking to understand' };

function renderStack(overrides: Partial<Parameters<typeof CardStack>[0]> = {}) {
  const props = {
    card: CARD,
    nextCard: NEXT,
    remaining: 8,
    onKeep: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  const view = render(
    <MotionProvider>
      <CardStack {...props} />
    </MotionProvider>,
  );
  return { ...view, props };
}

describe('CardStack deck faces (01.5)', () => {
  it('never renders the next card face-up — the deck is face-down, not low-opacity', () => {
    // This is the 01.3 spoiler fix, asserted as absence rather than opacity:
    // before 01.5 the next card's front was rendered at 60% opacity.
    renderStack({ resumed: true });
    expect(screen.queryByText('Curiosity')).toBeNull();
    expect(screen.queryByText('Seeking to understand')).toBeNull();
  });

  it('opens a fresh round face-down, with the turn-over control', () => {
    renderStack();
    expect(screen.queryByText('Courage')).toBeNull();
    expect(screen.getByRole('button', { name: 'Turn over' })).toBeDefined();
  });

  it('turning over reveals the active card and arms keep/discard', async () => {
    renderStack();
    await userEvent.click(screen.getByRole('button', { name: 'Turn over' }));
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep Courage' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard Courage' })).toBeDefined();
  });

  it('opens face-up on a resumed round — a refresh mid-deck never re-hides the card', () => {
    // Invariant 4: someone 22 cards deep must not be handed a face-down card.
    renderStack({ resumed: true });
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Turn over' })).toBeNull();
  });

  it('turns the next card over while the committed card is still exiting', async () => {
    renderStack({ resumed: true });
    // The next card's front only mounts once its flip has begun, so its
    // appearance *before* onKeep resolves is the observable proof of overlap.
    await userEvent.click(screen.getByRole('button', { name: 'Keep Courage' }));
    await waitFor(() => expect(screen.getByText('Curiosity')).toBeDefined(), { timeout: 3000 });
  });

  it('renders no deck beneath the last card', () => {
    renderStack({ resumed: true, nextCard: undefined });
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.queryByText('Curiosity')).toBeNull();
  });

  it('shows the remaining count', () => {
    renderStack({ resumed: true, remaining: 12 });
    expect(screen.getByText('12 left')).toBeDefined();
  });
});

describe('CardStack deck thickness (01.5)', () => {
  it('draws static backs behind the turning card so the stack is never empty', () => {
    renderStack({ resumed: true, remaining: 8 });
    // nextCard + 2 static backs, all face-down. Without the backs, the slot the
    // turning card occupies goes empty mid-flip and a replacement pops in after
    // the store advances.
    expect(document.querySelectorAll('[data-flipped="true"]')).toHaveLength(3);
  });

  it('thins the stack honestly near the bottom of the deck', () => {
    // Two cards left = active + next, nothing under them to draw.
    renderStack({ resumed: true, remaining: 2 });
    expect(document.querySelectorAll('[data-flipped="true"]')).toHaveLength(1);
    // Last card: nothing face-down at all.
    cleanup();
    renderStack({ resumed: true, remaining: 1, nextCard: undefined });
    expect(document.querySelectorAll('[data-flipped="true"]')).toHaveLength(0);
  });

  it('hides the decorative backs from assistive tech', () => {
    renderStack({ resumed: true, remaining: 8 });
    const hidden = [...document.querySelectorAll('[aria-hidden="true"]')].filter((el) =>
      el.querySelector('[data-flipped="true"]'),
    );
    expect(hidden).toHaveLength(2);
  });
});
