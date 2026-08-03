import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { KeptTray } from './KeptTray';

afterEach(cleanup);

const CARDS = [
  { value: 'Courage', description: 'Acting despite fear' },
  { value: 'Curiosity', description: 'Seeking to understand' },
];

function renderTray(tray: ReactElement) {
  return render(<MotionProvider>{tray}</MotionProvider>);
}

describe('KeptTray', () => {
  it('shows the kept count against the round limit', () => {
    renderTray(<KeptTray cards={CARDS} limit={8} onDemote={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Kept cards: 2 / 8 kept' })).toBeDefined();
  });

  it('shows a plain count with no limit for keep-any rounds', () => {
    renderTray(<KeptTray cards={CARDS} limit="any" onDemote={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Kept cards: 2 kept' })).toBeDefined();
    expect(screen.queryByText(/∞/)).toBeNull();
  });

  it('flags the counter over-limit with the danger token class', () => {
    renderTray(<KeptTray cards={CARDS} limit={1} onDemote={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Kept cards: 2 / 1 kept' });
    expect(trigger.className).toContain('text-danger');
  });

  it('expands to show kept cards and demotes one back to the queue', async () => {
    const onDemote = vi.fn();
    renderTray(<KeptTray cards={CARDS} limit={8} onDemote={onDemote} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kept cards: 2 / 8 kept' }));
    expect(screen.getByText('Courage')).toBeDefined();
    expect(screen.getByText('Curiosity')).toBeDefined();

    const demoteButtons = screen.getAllByRole('button', { name: 'Demote' });
    await userEvent.click(demoteButtons[0] as HTMLElement);
    expect(onDemote).toHaveBeenCalledWith('Courage');
  });

  // Regression: with a full tray the sheet grew past the viewport and its header — the only
  // dismiss control — was pushed off-screen with nothing to scroll, stranding the user in
  // the tray with no way back to the sort UI.
  describe('a full tray stays dismissable', () => {
    const FULL = Array.from({ length: 8 }, (_, i) => ({
      value: `Value ${i + 1}`,
      description: `Description ${i + 1}`,
    }));

    it('keeps Close outside the scrolling card grid', async () => {
      renderTray(<KeptTray cards={FULL} limit={8} onDemote={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: 'Kept cards: 8 / 8 kept' }));

      const close = screen.getByRole('button', { name: 'Close' });
      const grid = screen.getByText('Value 1').closest('.overflow-y-auto');
      expect(grid).not.toBeNull();
      // Close must not live inside the scroll container, or it scrolls away with the cards.
      expect(grid?.contains(close)).toBe(false);
      // ...and the sheet itself must be height-bounded, or there is nothing to scroll.
      expect(close.closest('[role="region"]')?.className).toContain('max-h-');
    });

    it('closes a full tray with Close, returning to the sort UI', async () => {
      renderTray(<KeptTray cards={FULL} limit={8} onDemote={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: 'Kept cards: 8 / 8 kept' }));
      expect(screen.getByText('Value 1')).toBeDefined();

      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('Value 1')).toBeNull();
    });

    it('closes on Escape, so dismissal never depends on layout', async () => {
      renderTray(<KeptTray cards={FULL} limit={8} onDemote={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: 'Kept cards: 8 / 8 kept' }));
      expect(screen.getByText('Value 1')).toBeDefined();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByText('Value 1')).toBeNull();
    });
  });
});
