import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionState } from '@values-cards/shared';
import { createSessionStore, type SessionStoreHook } from '../session/createSessionStore';
import { GatedContinue } from './GatedContinue';

afterEach(cleanup);

const BASE_STATE: SessionState = {
  code: 'ABC123',
  config: {
    title: 'Test',
    deck: { name: 'Test deck', cards: [{ value: 'Focus', description: 'd' }], source: 'bundled' },
    rounds: [
      { name: 'Round 1', keep: 1, rank: false },
      { name: 'Round 2', keep: 1, rank: false },
    ],
    theme: { variant: 'default' },
    facilitated: false,
  },
  phase: 'active',
  participants: {},
  reveals: {},
  spotlight: null,
  gate: { openRound: 1 },
  processedIntents: {},
  processedJoins: {},
};

/** Wires the presentational `GatedContinue` to a live session store — the real shape
 *  routes/Sort.tsx uses, and what lets this test "drive the store with a patch". */
function Harness({ useSessionStore, onContinue }: { useSessionStore: SessionStoreHook; onContinue: () => void }) {
  const gate = useSessionStore((s) => s.state?.gate ?? null);
  return <GatedContinue gate={gate} nextRound={2} onContinue={onContinue} />;
}

describe('GatedContinue', () => {
  it('blocks Continue and shows the waiting notice while the gate has not opened the next round', () => {
    const store = createSessionStore();
    store.getState().applyEvent({ type: 'state', state: BASE_STATE });

    render(<Harness useSessionStore={store} onContinue={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe('Waiting for Round 2 to open');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
  });

  it('unblocks Continue once a `setGate` patch opens the round', () => {
    const store = createSessionStore();
    store.getState().applyEvent({ type: 'state', state: BASE_STATE });

    render(<Harness useSessionStore={store} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);

    act(() => {
      store.getState().applyEvent({ type: 'patch', patch: { gate: { openRound: 2 } } });
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(false);
  });

  it('is never gated when no gate is set', () => {
    const store = createSessionStore();
    store.getState().applyEvent({ type: 'state', state: { ...BASE_STATE, gate: null } });

    render(<Harness useSessionStore={store} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(false);
  });
});
