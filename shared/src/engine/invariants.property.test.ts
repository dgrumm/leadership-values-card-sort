import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyIntent } from './apply-intent.js';
import type { SessionState } from '../schemas/session.js';
import type { Intent } from '../schemas/messages.js';

const P1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OUTSIDER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const DECK_CARDS = Array.from({ length: 5 }, (_, i) => ({ value: `Card${i}`, description: `Desc${i}` }));

function initialState(): SessionState {
  return {
    code: 'ABC123',
    config: {
      title: 'Prop test',
      deck: { name: 'Deck', cards: DECK_CARDS },
      rounds: [
        { name: 'R1', keep: 2, rank: false },
        { name: 'R2', keep: 1, rank: true },
      ],
      theme: { variant: 'default' },
      facilitated: true,
    },
    phase: 'active',
    participants: {
      [P1]: { name: 'P1', avatarHue: 1, role: 'facilitator', connected: true, progress: { round: 1, sorted: 0, kept: 0, done: false } },
      [P2]: { name: 'P2', avatarHue: 2, role: 'participant', connected: true, progress: { round: 1, sorted: 0, kept: 0, done: false } },
    },
    reveals: {},
    spotlight: null,
    gate: null,
    processedIntents: {},
  };
}

// Small pools so fast-check actually generates replays and cross-participant collisions.
const intentIdArb = fc.constantFrom('i0', 'i1', 'i2', 'i3', 'i4');
const participantArb = fc.constantFrom(P1, P2, OUTSIDER);
const roundArb = fc.integer({ min: 0, max: 3 });
const cardsArb = fc.subarray(DECK_CARDS, { minLength: 0, maxLength: DECK_CARDS.length });

type ParticipantIntent = Extract<Intent, { participantId: string }>;

const intentArb: fc.Arbitrary<ParticipantIntent> = fc.oneof(
  fc.record({
    type: fc.constant('reveal' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    round: roundArb,
    snapshot: fc.record({ cards: cardsArb, ranked: fc.boolean(), revealedAt: fc.integer() }),
  }),
  fc.record({
    type: fc.constant('unreveal' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    round: roundArb,
  }),
  fc.record({
    type: fc.constant('reportProgress' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    round: roundArb,
    sorted: fc.nat(),
    kept: fc.nat(),
    done: fc.boolean(),
  }),
  fc.record({
    type: fc.constant('setGate' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    round: roundArb,
  }),
  fc.record({
    type: fc.constant('setSpotlight' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    target: fc.oneof(fc.constant(null), participantArb),
  }),
  fc.record({
    type: fc.constant('nudge' as const),
    intentId: intentIdArb,
    participantId: participantArb,
    text: fc.string({ minLength: 1 }),
  }),
  fc.record({
    type: fc.constant('conclude' as const),
    intentId: intentIdArb,
    participantId: participantArb,
  }),
);

describe('applyIntent invariants (property)', () => {
  it('never violates write-once reveals, keep-count enforcement, idempotency, or reveal-data leakage', () => {
    fc.assert(
      fc.property(fc.array(intentArb, { minLength: 1, maxLength: 40 }), (intents) => {
        let state = initialState();
        const revealed = new Set<string>(); // `${participantId}:${round}` currently revealed
        const processedKeys = new Set<string>(); // `${participantId}:${intentId}` already applied once

        for (const intent of intents) {
          const beforeState = state;
          const dedupeKey = `${intent.participantId}:${intent.intentId}`;
          const isReplay = processedKeys.has(dedupeKey);

          const result = applyIntent(state, intent);

          if ('rejection' in result) continue;

          if (isReplay) {
            // Duplicate-intentId idempotency: a replay is a pure no-op on *current* state.
            expect(result.state).toEqual(beforeState);
            expect(result.events).toEqual([]);
            state = result.state;
            continue;
          }
          processedKeys.add(dedupeKey);

          if (intent.type === 'reveal') {
            const revealKey = `${intent.participantId}:${intent.round}`;
            // A genuinely new reveal can never target an already-revealed key (write-once).
            expect(revealed.has(revealKey)).toBe(false);
            const roundCfg = beforeState.config.rounds[intent.round - 1];
            if (roundCfg && roundCfg.keep !== 'any') {
              expect(intent.snapshot.cards.length).toBe(roundCfg.keep);
            }
            revealed.add(revealKey);
          }
          if (intent.type === 'unreveal') {
            revealed.delete(`${intent.participantId}:${intent.round}`);
          }

          // No event may carry reveal card data for a (participant, round) that isn't
          // actually revealed right now.
          for (const event of result.events) {
            if (event.type === 'patch' && event.patch.reveals) {
              for (const [pid, byRound] of Object.entries(event.patch.reveals)) {
                for (const [roundKey, snapshot] of Object.entries(byRound ?? {})) {
                  if (snapshot) {
                    expect(revealed.has(`${pid}:${roundKey}`)).toBe(true);
                  }
                }
              }
            }
          }

          state = result.state;
        }
        return true;
      }),
      { numRuns: 300 },
    );
  });
});
