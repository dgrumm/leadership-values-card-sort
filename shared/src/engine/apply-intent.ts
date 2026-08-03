import type { Intent, Event } from '../schemas/messages.js';
import type { Participant, SessionState } from '../schemas/session.js';
import { PROCESSED_INTENTS_CAP } from '../schemas/session.js';

export interface Rejection {
  code: string;
  message: string;
}

export type ApplyIntentResult = { state: SessionState; events: Event[] } | { rejection: Rejection };

export interface ApplyIntentDeps {
  /** Overridable for deterministic tests; defaults to a real UUID. */
  newParticipantId: () => string;
}

const defaultDeps: ApplyIntentDeps = { newParticipantId: () => crypto.randomUUID() };

function reject(code: string, message: string): ApplyIntentResult {
  return { rejection: { code, message } };
}

function ok(state: SessionState, events: Event[] = []): ApplyIntentResult {
  return { state, events };
}

/** Records intentId in the participant's bounded LRU (mutates a cloned array in place). */
function recordProcessed(state: SessionState, participantId: string, intentId: string): SessionState {
  const existing = state.processedIntents[participantId] ?? [];
  const updated = [...existing, intentId].slice(-PROCESSED_INTENTS_CAP);
  return {
    ...state,
    processedIntents: { ...state.processedIntents, [participantId]: updated },
  };
}

function alreadyProcessed(state: SessionState, participantId: string, intentId: string): boolean {
  return (state.processedIntents[participantId] ?? []).includes(intentId);
}

/** Records a join intentId -> minted participantId, bounded like the per-participant LRU. */
function recordJoin(state: SessionState, intentId: string, participantId: string): SessionState {
  const entries = [...Object.entries(state.processedJoins), [intentId, participantId] as const].slice(
    -PROCESSED_INTENTS_CAP,
  );
  return { ...state, processedJoins: Object.fromEntries(entries) };
}

function requireParticipant(state: SessionState, participantId: string): Participant | undefined {
  return state.participants[participantId];
}

/**
 * The session DO's reducer. Pure: given the same state + intent (+ deps), always
 * produces the same result. `deps.newParticipantId` is the only side-channel,
 * needed because `join` mints a new opaque identity the caller can't supply.
 */
export function applyIntent(state: SessionState, intent: Intent, deps: ApplyIntentDeps = defaultDeps): ApplyIntentResult {
  // Idempotency: a replayed intentId is a no-op returning the *current* state and no
  // events. `join` has no participantId yet (the reducer mints one), so it's deduped
  // separately via `processedJoins` inside the 'join' case below.
  if (intent.type !== 'join' && alreadyProcessed(state, intent.participantId, intent.intentId)) {
    return ok(state, []);
  }

  switch (intent.type) {
    case 'join': {
      // Idempotency: a replayed join intentId is a no-op on current state — it must never
      // mint a second participant (e.g. a second facilitator) for a retried ack.
      if (intent.intentId in state.processedJoins) {
        return ok(state, []);
      }
      if (state.phase === 'concluded') {
        return reject('SESSION_CONCLUDED', 'cannot join a concluded session');
      }
      const participantId = deps.newParticipantId();
      // Facilitator iff the DO verified a `creatorToken` — NOT join order. Whoever creates the
      // session owns it, even if a participant races them to the first join (spec 01.1).
      const participant: Participant = {
        name: intent.name,
        avatarHue: hueFromId(participantId),
        role: intent.isCreator === true ? 'facilitator' : 'participant',
        connected: true,
        progress: { round: 1, sorted: 0, kept: 0, done: false },
      };
      const next: SessionState = recordJoin(
        {
          ...state,
          participants: { ...state.participants, [participantId]: participant },
        },
        intent.intentId,
        participantId,
      );
      return ok(next, [{ type: 'state', state: next }]);
    }

    case 'rejoin': {
      const existing = requireParticipant(state, intent.participantId);
      if (!existing) {
        return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      }
      const next = recordProcessed(
        {
          ...state,
          participants: {
            ...state.participants,
            [intent.participantId]: { ...existing, connected: true },
          },
        },
        intent.participantId,
        intent.intentId,
      );
      return ok(next, [{ type: 'state', state: next }]);
    }

    case 'updateConfig': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      if (participant.role !== 'facilitator') return reject('FORBIDDEN', 'only the facilitator can update config');
      if (state.phase !== 'lobby') return reject('LOCKED', 'config can only change in the lobby');
      const next = recordProcessed({ ...state, config: intent.config }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { config: next.config } }]);
    }

    case 'startGame': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      if (participant.role !== 'facilitator') return reject('FORBIDDEN', 'only the facilitator can start the game');
      if (state.phase !== 'lobby') return reject('LOCKED', 'game already started');
      const next = recordProcessed({ ...state, phase: 'active' as const }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { phase: next.phase } }]);
    }

    case 'reportProgress': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      const progress = { round: intent.round, sorted: intent.sorted, kept: intent.kept, done: intent.done };
      const next = recordProcessed(
        {
          ...state,
          participants: {
            ...state.participants,
            [intent.participantId]: { ...participant, progress },
          },
        },
        intent.participantId,
        intent.intentId,
      );
      return ok(next, [
        { type: 'patch', patch: { participants: { [intent.participantId]: { ...participant, progress } } } },
      ]);
    }

    case 'reveal': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      const roundCfg = state.config.rounds[intent.round - 1];
      if (!roundCfg) return reject('INVALID_ROUND', 'no such round in this config');
      if (state.gate && intent.round > state.gate.openRound) {
        return reject('GATE_CLOSED', 'this round has not been opened by the facilitator yet');
      }
      const existingForParticipant = state.reveals[intent.participantId] ?? {};
      if (existingForParticipant[intent.round]) {
        return reject('ALREADY_REVEALED', 'this round has already been revealed (write-once)');
      }
      const expectedCount = roundCfg.keep === 'any' ? undefined : roundCfg.keep;
      if (expectedCount !== undefined && intent.snapshot.cards.length !== expectedCount) {
        return reject('KEEP_COUNT_MISMATCH', `expected exactly ${expectedCount} cards, got ${intent.snapshot.cards.length}`);
      }
      if (expectedCount === undefined && intent.snapshot.cards.length > state.config.deck.cards.length) {
        return reject('KEEP_COUNT_MISMATCH', 'more cards revealed than exist in the deck');
      }
      if (intent.snapshot.ranked !== roundCfg.rank) {
        return reject('RANK_MISMATCH', `this round's ranked flag must be ${roundCfg.rank}`);
      }
      const deckValues = new Set(state.config.deck.cards.map((card) => card.value));
      if (!intent.snapshot.cards.every((card) => deckValues.has(card.value))) {
        return reject('UNKNOWN_CARD', 'revealed cards must exist in this game\'s deck');
      }
      const reveals = {
        ...state.reveals,
        [intent.participantId]: { ...existingForParticipant, [intent.round]: intent.snapshot },
      };
      const next = recordProcessed({ ...state, reveals }, intent.participantId, intent.intentId);
      return ok(next, [
        { type: 'patch', patch: { reveals: { [intent.participantId]: { [intent.round]: intent.snapshot } } } },
      ]);
    }

    case 'unreveal': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      const existingForParticipant = state.reveals[intent.participantId] ?? {};
      const rest = { ...existingForParticipant };
      delete rest[intent.round];
      const reveals = { ...state.reveals, [intent.participantId]: rest };
      const next = recordProcessed({ ...state, reveals }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { reveals: { [intent.participantId]: rest } } }]);
    }

    case 'nudge': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      if (participant.role !== 'facilitator') return reject('FORBIDDEN', 'only the facilitator can nudge');
      const next = recordProcessed(state, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'nudge', text: intent.text }]);
    }

    case 'setGate': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      if (participant.role !== 'facilitator') return reject('FORBIDDEN', 'only the facilitator can set the gate');
      const gate = { openRound: intent.round };
      const next = recordProcessed({ ...state, gate }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { gate } }]);
    }

    case 'setSpotlight': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      const spotlightingSelf = intent.target === intent.participantId;
      if (!spotlightingSelf && participant.role !== 'facilitator') {
        return reject('FORBIDDEN', 'only the facilitator can spotlight another participant');
      }
      const next = recordProcessed({ ...state, spotlight: intent.target }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { spotlight: next.spotlight } }]);
    }

    case 'conclude': {
      const participant = requireParticipant(state, intent.participantId);
      if (!participant) return reject('UNKNOWN_PARTICIPANT', 'no participant with that id');
      if (participant.role !== 'facilitator') return reject('FORBIDDEN', 'only the facilitator can conclude');
      const next = recordProcessed({ ...state, phase: 'concluded' as const }, intent.participantId, intent.intentId);
      return ok(next, [{ type: 'patch', patch: { phase: next.phase } }]);
    }
  }
}

/** Deterministic 0-359 hue from a UUID — a label-safe avatar color, not identity. */
function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
