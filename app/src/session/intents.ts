import { z } from 'zod';
import { UuidSchema, type GameConfig, type Intent, type RevealSnapshot } from '@values-cards/shared';

/**
 * The DO sends this once, right after a successful `join` — it's transport/auth
 * (the freshly minted rejoin credential), not a game `Event`, so it isn't part of
 * `EventSchema` and is parsed separately (`useSession.ts`).
 */
export const WelcomeSchema = z.strictObject({
  type: z.literal('welcome'),
  participantId: UuidSchema,
  participantToken: z.string().min(1),
});
export type Welcome = z.infer<typeof WelcomeSchema>;

/**
 * Typed intent creators — the only place `crypto.randomUUID()` is called for
 * `intentId`, so every outbound intent is idempotent-by-construction (tenet 1).
 */
export const intents = {
  join: (name: string): Intent => ({ type: 'join', intentId: crypto.randomUUID(), name }),
  rejoin: (participantId: string): Intent => ({ type: 'rejoin', intentId: crypto.randomUUID(), participantId }),
  updateConfig: (participantId: string, config: GameConfig): Intent => ({
    type: 'updateConfig',
    intentId: crypto.randomUUID(),
    participantId,
    config,
  }),
  startGame: (participantId: string): Intent => ({ type: 'startGame', intentId: crypto.randomUUID(), participantId }),
  reportProgress: (
    participantId: string,
    round: number,
    sorted: number,
    kept: number,
    done: boolean,
  ): Intent => ({ type: 'reportProgress', intentId: crypto.randomUUID(), participantId, round, sorted, kept, done }),
  reveal: (participantId: string, round: number, snapshot: RevealSnapshot): Intent => ({
    type: 'reveal',
    intentId: crypto.randomUUID(),
    participantId,
    round,
    snapshot,
  }),
  unreveal: (participantId: string, round: number): Intent => ({
    type: 'unreveal',
    intentId: crypto.randomUUID(),
    participantId,
    round,
  }),
  nudge: (participantId: string, text: string): Intent => ({
    type: 'nudge',
    intentId: crypto.randomUUID(),
    participantId,
    text,
  }),
  setGate: (participantId: string, round: number): Intent => ({
    type: 'setGate',
    intentId: crypto.randomUUID(),
    participantId,
    round,
  }),
  setSpotlight: (participantId: string, target: string | null): Intent => ({
    type: 'setSpotlight',
    intentId: crypto.randomUUID(),
    participantId,
    target,
  }),
  conclude: (participantId: string): Intent => ({ type: 'conclude', intentId: crypto.randomUUID(), participantId }),
};
