import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../theme/motion';
import { TrimGrid } from './TrimGrid';

afterEach(cleanup);

const CARDS = [
  { value: 'Courage', description: 'Acting despite fear' },
  { value: 'Curiosity', description: 'Seeking to understand' },
  { value: 'Integrity', description: 'Consistency of values and action' },
];

function renderGrid(element: ReactElement) {
  const result = render(<MotionProvider>{element}</MotionProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(<MotionProvider>{next}</MotionProvider>),
  };
}

describe('TrimGrid', () => {
  it('counts down to the keep-count', () => {
    renderGrid(<TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Cut 2 more')).toBeDefined();
  });

  it('tapping a card toggles it cut', async () => {
    const onToggleCut = vi.fn();
    renderGrid(<TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={onToggleCut} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('listitem', { name: 'Courage' }));
    expect(onToggleCut).toHaveBeenCalledWith('Courage');
  });

  it('shows the cut badge and dims a cut card, and re-counts the header', () => {
    renderGrid(<TrimGrid cards={CARDS} cut={['Courage']} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Cut 1 more')).toBeDefined();
    const cutItem = screen.getByRole('listitem', { name: 'Courage, cut' });
    expect(cutItem.getAttribute('aria-pressed')).toBe('true');
    expect(cutItem.className).toContain('opacity-50');
  });

  it('Confirm is disabled while over the limit and enabled at/under it (invariant 3)', () => {
    const { rerender } = renderGrid(
      <TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', true);

    rerender(<TrimGrid cards={CARDS} cut={['Courage', 'Curiosity']} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false);
  });

  it('Confirm calls onConfirm', async () => {
    const onConfirm = vi.fn();
    renderGrid(
      <TrimGrid cards={CARDS} cut={['Courage', 'Curiosity']} limit={1} onToggleCut={vi.fn()} onConfirm={onConfirm} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is fully keyboard operable: arrow keys move the roving tab stop, Enter toggles cut', async () => {
    const onToggleCut = vi.fn();
    renderGrid(<TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={onToggleCut} onConfirm={vi.fn()} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.tabIndex).toBe(0);
    expect(items[1]?.tabIndex).toBe(-1);

    (items[0] as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(items[1]);

    await userEvent.keyboard('{Enter}');
    expect(onToggleCut).toHaveBeenCalledWith('Curiosity');
  });

  it('announces cut and restore for screen readers', () => {
    const { rerender } = renderGrid(
      <TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />,
    );
    rerender(<TrimGrid cards={CARDS} cut={['Courage']} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Courage cut');

    rerender(<TrimGrid cards={CARDS} cut={[]} limit={1} onToggleCut={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Courage restored');
  });
});
