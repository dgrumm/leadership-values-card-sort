import { describe, expect, it } from 'vitest';
import type { SessionState } from '@values-cards/shared';
import { createSessionStore } from './createSessionStore';

const BASE_STATE: SessionState = {
  code: 'ABC123',
  config: {
    title: 'Test',
    deck: { name: 'Test deck', cards: [{ value: 'Focus', description: 'd' }], source: 'bundled' },
    rounds: [{ name: 'Round 1', keep: 1, rank: false }],
    theme: { variant: 'default' },
    facilitated: false,
  },
  phase: 'lobby',
  participants: {
    'p-1': { name: 'Ada', avatarHue: 10, role: 'facilitator', connected: true, progress: { round: 1, sorted: 0, kept: 0, done: false } },
  },
  reveals: {},
  spotlight: null,
  gate: null,
  processedIntents: {},
  processedJoins: {},
};

describe('createSessionStore', () => {
  it('two stores are isolated — no shared module-level state', () => {
    const useStoreA = createSessionStore();
    const useStoreB = createSessionStore();
    useStoreA.getState().applyEvent({ type: 'state', state: BASE_STATE });
    expect(useStoreA.getState().state).not.toBeNull();
    expect(useStoreB.getState().state).toBeNull();
  });

  it('a full state event replaces the store state', () => {
    const useStore = createSessionStore();
    useStore.getState().applyEvent({ type: 'state', state: BASE_STATE });
    expect(useStore.getState().state?.code).toBe('ABC123');
  });

  it('a patch before any state event is dropped, not crashed on', () => {
    const useStore = createSessionStore();
    useStore.getState().applyEvent({ type: 'patch', patch: { phase: 'active' } });
    expect(useStore.getState().state).toBeNull();
  });

  it('a patch merges a scalar top-level field', () => {
    const useStore = createSessionStore();
    useStore.getState().applyEvent({ type: 'state', state: BASE_STATE });
    useStore.getState().applyEvent({ type: 'patch', patch: { phase: 'active' } });
    expect(useStore.getState().state?.phase).toBe('active');
  });

  it('a participants patch merges one level deep — other participants survive', () => {
    const useStore = createSessionStore();
    useStore.getState().applyEvent({
      type: 'state',
      state: {
        ...BASE_STATE,
        participants: {
          ...BASE_STATE.participants,
          'p-2': { name: 'Bea', avatarHue: 20, role: 'participant', connected: true, progress: { round: 1, sorted: 0, kept: 0, done: false } },
        },
      },
    });
    useStore.getState().applyEvent({
      type: 'patch',
      patch: {
        participants: {
          'p-2': { name: 'Bea', avatarHue: 20, role: 'participant', connected: false, progress: { round: 1, sorted: 0, kept: 0, done: false } },
        },
      },
    });
    const participants = useStore.getState().state?.participants;
    expect(participants?.['p-1']?.connected).toBe(true);
    expect(participants?.['p-2']?.connected).toBe(false);
  });
});
