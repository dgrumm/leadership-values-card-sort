import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Participant } from '@values-cards/shared';
import { Roster } from './Roster';

afterEach(cleanup);

function participants(): Record<string, Participant> {
  return {
    a1: {
      name: 'Ada',
      avatarHue: 120,
      role: 'facilitator',
      connected: true,
      progress: { round: 2, sorted: 14, kept: 5, done: false },
    },
    b2: {
      name: 'Bea',
      avatarHue: 240,
      role: 'participant',
      connected: false,
      progress: { round: 1, sorted: 0, kept: 0, done: true },
    },
  };
}

describe('Roster', () => {
  it('renders an accessible list with names, roles, progress, and connection status', () => {
    render(<Roster participants={participants()} selfId="a1" />);

    const list = screen.getByRole('list', { name: 'Participants' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(within(items[0]!).getByText(/Ada/)).toBeTruthy();
    expect(within(items[0]!).getByText(/\(you\)/)).toBeTruthy();
    expect(within(items[0]!).getByText(/Facilitator/)).toBeTruthy();
    expect(within(items[0]!).getByText('Round 2 · 14 sorted · 5 kept')).toBeTruthy();
    expect(within(items[0]!).getByText('Connected')).toBeTruthy();

    expect(within(items[1]!).getByText(/Bea/)).toBeTruthy();
    expect(within(items[1]!).queryByText(/\(you\)/)).toBeNull();
    expect(within(items[1]!).getByText('Done ✓')).toBeTruthy();
    expect(within(items[1]!).getByText('Disconnected')).toBeTruthy();
  });

  it('never renders card data — only counts', () => {
    render(<Roster participants={participants()} selfId="a1" />);
    // The roster's own text should only ever contain names/roles/counts, so this is a
    // structural sanity check that nothing here comes from deck content.
    expect(screen.queryByText(/Card|Caffeine|Snacks/)).toBeNull();
  });

  it('is sorted by join order (object insertion order)', () => {
    render(<Roster participants={participants()} selfId="a1" />);
    const names = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(names[0]).toMatch(/Ada/);
    expect(names[1]).toMatch(/Bea/);
  });

  it('collapsible: starts as an avatar strip and expands into the full list on click', () => {
    render(<Roster participants={participants()} selfId="a1" collapsible />);
    expect(screen.queryByRole('list', { name: 'Participants' })).toBeNull();

    const toggle = screen.getByRole('button', { name: /Show participants/ });
    fireEvent.click(toggle);

    expect(screen.getByRole('list', { name: 'Participants' })).toBeTruthy();
  });
});
