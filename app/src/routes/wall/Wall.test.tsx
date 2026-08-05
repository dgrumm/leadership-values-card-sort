import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionState } from '@values-cards/shared';
import { MotionProvider } from '../../theme/motion';
import { WallBody } from './Wall';

afterEach(cleanup);

function baseState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    code: 'ABC123',
    config: {
      title: 'Values Night',
      deck: { name: 'Deck', cards: [{ value: 'Curiosity', description: 'd1' }, { value: 'Courage', description: 'd2' }] },
      rounds: [{ name: 'Round 1', keep: 2, rank: false }],
      theme: { variant: 'default' },
      facilitated: false,
    },
    phase: 'active',
    participants: {
      facilitator: { name: 'Ada', avatarHue: 20, role: 'facilitator', connected: true, progress: { round: 1, sorted: 2, kept: 2, done: true } },
      bea: { name: 'Bea', avatarHue: 200, role: 'participant', connected: true, progress: { round: 1, sorted: 2, kept: 2, done: true } },
    },
    reveals: {
      bea: { 1: { cards: [{ value: 'Curiosity', description: 'd1' }, { value: 'Courage', description: 'd2' }], ranked: false, revealedAt: 1 } },
    },
    spotlight: null,
    gate: null,
    processedIntents: {},
    processedJoins: {},
    ...overrides,
  };
}

function renderWall(state: SessionState, participantId: string, send = vi.fn()) {
  render(
    <MotionProvider>
      <WallBody state={state} participantId={participantId} send={send} />
    </MotionProvider>,
  );
  return send;
}

describe('WallBody', () => {
  it('renders an empty-state invite when nobody has revealed yet', () => {
    renderWall(baseState({ reveals: {} }), 'facilitator');
    expect(screen.getByText(/No results yet/)).not.toBeNull();
  });

  it('renders a plaque for each revealed participant', () => {
    renderWall(baseState(), 'facilitator');
    expect(screen.getByText('Bea')).not.toBeNull();
  });

  it('lets the facilitator spotlight another participant plaque by keyboard', async () => {
    const user = userEvent.setup();
    const send = renderWall(baseState(), 'facilitator');
    const tile = screen.getByRole('button', { name: "Spotlight Bea's round 1 result" });
    tile.focus();
    await user.keyboard('{Enter}');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'setSpotlight', participantId: 'facilitator', target: 'bea' }));
  });

  it('enables the spotlight control for a participant\'s own plaque', () => {
    renderWall(baseState(), 'bea', vi.fn());
    const tile = screen.getByRole('button', { name: "Spotlight Bea's round 1 result" }) as HTMLButtonElement;
    expect(tile.disabled).toBe(false);
  });

  it('disables spotlighting someone else\'s plaque for a non-facilitator participant', () => {
    const state = baseState({
      reveals: {
        bea: { 1: { cards: [{ value: 'Curiosity', description: 'd1' }], ranked: false, revealedAt: 1 } },
        facilitator: { 1: { cards: [{ value: 'Courage', description: 'd2' }], ranked: false, revealedAt: 1 } },
      },
    });
    renderWall(state, 'bea');
    const tile = screen.getByRole('button', { name: "Spotlight Ada's round 1 result" }) as HTMLButtonElement;
    expect(tile.disabled).toBe(true);
  });

  it('does not announce anything on initial mount, even onto an already-spotlit wall', () => {
    renderWall(baseState({ spotlight: 'bea' }), 'facilitator');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('announces a spotlight change via an aria-live region, on an actual transition', () => {
    const send = vi.fn();
    const { rerender } = render(
      <MotionProvider>
        <WallBody state={baseState()} participantId="facilitator" send={send} />
      </MotionProvider>,
    );
    expect(screen.getByRole('status').textContent).toBe('');

    rerender(
      <MotionProvider>
        <WallBody state={baseState({ spotlight: 'bea' })} participantId="facilitator" send={send} />
      </MotionProvider>,
    );
    expect(screen.getByRole('status').textContent).toBe("Bea's result is now spotlighted");

    rerender(
      <MotionProvider>
        <WallBody state={baseState({ spotlight: null })} participantId="facilitator" send={send} />
      </MotionProvider>,
    );
    expect(screen.getByRole('status').textContent).toBe('Spotlight released');
  });

  it('disables every spotlight control once the session has concluded', () => {
    renderWall(baseState({ phase: 'concluded' }), 'facilitator');
    const tile = screen.getByRole('button', { name: "Spotlight Bea's round 1 result" }) as HTMLButtonElement;
    expect(tile.disabled).toBe(true);
  });

  it('releases the spotlight on Escape when the local user is allowed to release', async () => {
    const user = userEvent.setup();
    const state = baseState({ spotlight: 'bea' });
    const send = renderWall(state, 'facilitator');
    await user.keyboard('{Escape}');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'setSpotlight', participantId: 'facilitator', target: null }));
  });
});
