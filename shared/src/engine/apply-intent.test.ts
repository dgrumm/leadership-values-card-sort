import { describe, expect, it } from 'vitest';
import { applyIntent, type ApplyIntentDeps } from './apply-intent.js';
import type { SessionState } from '../schemas/session.js';
import type { Deck } from '../schemas/deck.js';

const FACILITATOR = '11111111-1111-1111-1111-111111111111';
const PARTICIPANT = '22222222-2222-2222-2222-222222222222';
const OUTSIDER = '33333333-3333-3333-3333-333333333333';

function deckOf(count: number): Deck {
  return {
    name: 'Deck',
    cards: Array.from({ length: count }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
  };
}

function baseState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    code: 'ABC123',
    config: {
      title: 'Test',
      deck: deckOf(10),
      rounds: [
        { name: 'Round 1', keep: 3, rank: false },
        { name: 'Round 2', keep: 1, rank: true },
      ],
      theme: { variant: 'default' },
      facilitated: true,
    },
    phase: 'lobby',
    participants: {
      [FACILITATOR]: {
        name: 'Facilitator',
        avatarHue: 10,
        role: 'facilitator',
        connected: true,
        progress: { round: 1, sorted: 0, kept: 0, done: false },
      },
      [PARTICIPANT]: {
        name: 'Participant',
        avatarHue: 20,
        role: 'participant',
        connected: true,
        progress: { round: 1, sorted: 0, kept: 0, done: false },
      },
    },
    reveals: {},
    spotlight: null,
    gate: null,
    processedIntents: {},
    processedJoins: {},
    ...overrides,
  };
}

function deps(id = OUTSIDER): ApplyIntentDeps {
  return { newParticipantId: () => id };
}

describe('applyIntent: join', () => {
  it('adds a new participant and emits a state event', () => {
    const state = baseState({ participants: {} });
    const result = applyIntent(state, { type: 'join', intentId: 'i1', name: 'Ada' }, deps());
    expect('rejection' in result).toBe(false);
    if (!('rejection' in result)) {
      expect(result.state.participants[OUTSIDER]?.name).toBe('Ada');
      expect(result.state.participants[OUTSIDER]?.role).toBe('facilitator'); // first joiner
      expect(result.events).toEqual([{ type: 'state', state: result.state }]);
    }
  });

  it('rejects joining a concluded session', () => {
    const state = baseState({ phase: 'concluded' });
    const result = applyIntent(state, { type: 'join', intentId: 'i1', name: 'Ada' }, deps());
    expect('rejection' in result).toBe(true);
  });

  it('a replayed join intentId is a no-op: one participant, unchanged state', () => {
    const state = baseState({ participants: {} });
    const intent = { type: 'join' as const, intentId: 'i1', name: 'Ada' };
    const first = applyIntent(state, intent, deps(OUTSIDER));
    if ('rejection' in first) throw new Error('unexpected rejection');
    expect(Object.keys(first.state.participants)).toHaveLength(1);

    // Different `deps` (a distinct minted id) proves the replay is short-circuited by
    // the intentId dedup, not coincidentally producing the same id twice.
    const second = applyIntent(first.state, intent, deps(PARTICIPANT));
    if ('rejection' in second) throw new Error('unexpected rejection');
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual([]);
    expect(Object.keys(second.state.participants)).toHaveLength(1);
  });
});

describe('applyIntent: rejoin', () => {
  it('marks the participant connected and resends full state', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'rejoin', intentId: 'i1', participantId: PARTICIPANT });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.participants[PARTICIPANT]?.connected).toBe(true);
    expect(result.events[0]?.type).toBe('state');
  });

  it('rejects an unknown participant', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'rejoin', intentId: 'i1', participantId: OUTSIDER });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: updateConfig', () => {
  it('accepts a facilitator update in lobby', () => {
    const state = baseState();
    const newConfig = { ...state.config, title: 'Renamed' };
    const result = applyIntent(state, {
      type: 'updateConfig',
      intentId: 'i1',
      participantId: FACILITATOR,
      config: newConfig,
    });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.config.title).toBe('Renamed');
  });

  it('rejects a non-facilitator update', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'updateConfig',
      intentId: 'i1',
      participantId: PARTICIPANT,
      config: state.config,
    });
    expect('rejection' in result).toBe(true);
  });

  it('rejects updates once the game is active', () => {
    const state = baseState({ phase: 'active' });
    const result = applyIntent(state, {
      type: 'updateConfig',
      intentId: 'i1',
      participantId: FACILITATOR,
      config: state.config,
    });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: startGame', () => {
  it('locks config and moves to active', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'startGame', intentId: 'i1', participantId: FACILITATOR });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.phase).toBe('active');
  });

  it('rejects a non-facilitator start', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'startGame', intentId: 'i1', participantId: PARTICIPANT });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: reportProgress', () => {
  it('updates progress for the participant', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'reportProgress',
      intentId: 'i1',
      participantId: PARTICIPANT,
      round: 1,
      sorted: 5,
      kept: 3,
      done: true,
    });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.participants[PARTICIPANT]?.progress).toEqual({ round: 1, sorted: 5, kept: 3, done: true });
  });

  it('rejects an unknown participant', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'reportProgress',
      intentId: 'i1',
      participantId: OUTSIDER,
      round: 1,
      sorted: 0,
      kept: 0,
      done: false,
    });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: reveal', () => {
  it('accepts a matching keep-count reveal', () => {
    const state = baseState({ phase: 'active' });
    const snapshot = { cards: [state.config.deck.cards[0]!, state.config.deck.cards[1]!, state.config.deck.cards[2]!], ranked: false, revealedAt: 1 };
    const result = applyIntent(state, { type: 'reveal', intentId: 'i1', participantId: PARTICIPANT, round: 1, snapshot });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.reveals[PARTICIPANT]?.[1]).toEqual(snapshot);
  });

  it('rejects a card count that does not match the round keep-count', () => {
    const state = baseState({ phase: 'active' });
    const snapshot = { cards: [state.config.deck.cards[0]!], ranked: false, revealedAt: 1 };
    const result = applyIntent(state, { type: 'reveal', intentId: 'i1', participantId: PARTICIPANT, round: 1, snapshot });
    expect('rejection' in result).toBe(true);
  });

  it('rejects a second reveal of the same round (write-once)', () => {
    const snapshot = { cards: [state0Cards()[0]!, state0Cards()[1]!, state0Cards()[2]!], ranked: false, revealedAt: 1 };
    const state = baseState({ phase: 'active', reveals: { [PARTICIPANT]: { 1: snapshot } } });
    const result = applyIntent(state, { type: 'reveal', intentId: 'i2', participantId: PARTICIPANT, round: 1, snapshot });
    expect('rejection' in result).toBe(true);
  });

  it('rejects a reveal for a round beyond the open gate', () => {
    const state = baseState({ phase: 'active', gate: { openRound: 0 } });
    const snapshot = { cards: [state.config.deck.cards[0]!, state.config.deck.cards[1]!, state.config.deck.cards[2]!], ranked: false, revealedAt: 1 };
    const result = applyIntent(state, { type: 'reveal', intentId: 'i1', participantId: PARTICIPANT, round: 1, snapshot });
    expect('rejection' in result).toBe(true);
  });

  it('rejects a mismatched ranked flag', () => {
    const state = baseState({ phase: 'active' });
    const snapshot = { cards: [state.config.deck.cards[0]!, state.config.deck.cards[1]!, state.config.deck.cards[2]!], ranked: true, revealedAt: 1 };
    const result = applyIntent(state, { type: 'reveal', intentId: 'i1', participantId: PARTICIPANT, round: 1, snapshot });
    expect('rejection' in result).toBe(true);
  });

  it('rejects a snapshot card that is not in the deck', () => {
    const state = baseState({ phase: 'active' });
    const snapshot = {
      cards: [state.config.deck.cards[0]!, state.config.deck.cards[1]!, { value: 'Fabricated', description: 'not real' }],
      ranked: false,
      revealedAt: 1,
    };
    const result = applyIntent(state, { type: 'reveal', intentId: 'i1', participantId: PARTICIPANT, round: 1, snapshot });
    expect('rejection' in result).toBe(true);
  });

  function state0Cards() {
    return baseState().config.deck.cards;
  }
});

describe('applyIntent: unreveal', () => {
  it('deletes an existing reveal, allowing a later re-reveal', () => {
    const snapshot = { cards: [{ value: 'a', description: 'a' }], ranked: false, revealedAt: 1 };
    const state = baseState({ reveals: { [PARTICIPANT]: { 1: snapshot } } });
    const result = applyIntent(state, { type: 'unreveal', intentId: 'i1', participantId: PARTICIPANT, round: 1 });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.reveals[PARTICIPANT]?.[1]).toBeUndefined();
  });
});

describe('applyIntent: nudge', () => {
  it('lets the facilitator nudge', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'nudge', intentId: 'i1', participantId: FACILITATOR, text: 'hi' });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.events).toEqual([{ type: 'nudge', text: 'hi' }]);
  });

  it('rejects a participant nudge', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'nudge', intentId: 'i1', participantId: PARTICIPANT, text: 'hi' });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: setGate', () => {
  it('lets the facilitator open a round', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'setGate', intentId: 'i1', participantId: FACILITATOR, round: 1 });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.gate).toEqual({ openRound: 1 });
  });

  it('rejects a participant setting the gate', () => {
    const state = baseState();
    const result = applyIntent(state, { type: 'setGate', intentId: 'i1', participantId: PARTICIPANT, round: 1 });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: setSpotlight', () => {
  it('lets a participant spotlight themselves', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'setSpotlight',
      intentId: 'i1',
      participantId: PARTICIPANT,
      target: PARTICIPANT,
    });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.spotlight).toBe(PARTICIPANT);
  });

  it('rejects a participant spotlighting someone else', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'setSpotlight',
      intentId: 'i1',
      participantId: PARTICIPANT,
      target: FACILITATOR,
    });
    expect('rejection' in result).toBe(true);
  });

  it('lets the facilitator spotlight anyone', () => {
    const state = baseState();
    const result = applyIntent(state, {
      type: 'setSpotlight',
      intentId: 'i1',
      participantId: FACILITATOR,
      target: PARTICIPANT,
    });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.spotlight).toBe(PARTICIPANT);
  });
});

describe('applyIntent: conclude', () => {
  it('lets the facilitator conclude', () => {
    const state = baseState({ phase: 'active' });
    const result = applyIntent(state, { type: 'conclude', intentId: 'i1', participantId: FACILITATOR });
    if ('rejection' in result) throw new Error('unexpected rejection');
    expect(result.state.phase).toBe('concluded');
  });

  it('rejects a participant concluding', () => {
    const state = baseState({ phase: 'active' });
    const result = applyIntent(state, { type: 'conclude', intentId: 'i1', participantId: PARTICIPANT });
    expect('rejection' in result).toBe(true);
  });
});

describe('applyIntent: idempotency', () => {
  it('a replayed intentId is a no-op: unchanged state, no events', () => {
    const state = baseState();
    const intent = { type: 'setGate' as const, intentId: 'dup', participantId: FACILITATOR, round: 1 };
    const first = applyIntent(state, intent);
    if ('rejection' in first) throw new Error('unexpected rejection');
    const second = applyIntent(first.state, intent);
    if ('rejection' in second) throw new Error('unexpected rejection');
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual([]);
  });
});
