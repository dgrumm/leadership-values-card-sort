import { z } from 'zod';
import { CardSchema } from './deck.js';
import { GameConfigSchema } from './config.js';
import { UuidSchema } from './common.js';

export const RevealSnapshotSchema = z.object({
  cards: z.array(CardSchema),
  ranked: z.boolean(),
  revealedAt: z.number(),
});
export type RevealSnapshot = z.infer<typeof RevealSnapshotSchema>;

export const ProgressSchema = z.object({
  round: z.number().int().nonnegative(),
  sorted: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  done: z.boolean(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const ParticipantSchema = z.object({
  name: z.string().min(1),
  avatarHue: z.number(),
  role: z.enum(['facilitator', 'participant']),
  connected: z.boolean(),
  progress: ProgressSchema,
});
export type Participant = z.infer<typeof ParticipantSchema>;

/** Bounded LRU cap enforced by the reducer, not the schema — see apply-intent.ts. */
export const PROCESSED_INTENTS_CAP = 64;

export const SessionStateSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  config: GameConfigSchema,
  phase: z.enum(['lobby', 'active', 'concluded']),
  participants: z.record(UuidSchema, ParticipantSchema),
  reveals: z.record(UuidSchema, z.record(z.coerce.number().int().nonnegative(), RevealSnapshotSchema)),
  spotlight: z.union([UuidSchema, z.null()]),
  gate: z.union([z.object({ openRound: z.number().int().nonnegative() }), z.null()]),
  processedIntents: z.record(UuidSchema, z.array(z.string())),
});
export type SessionState = z.infer<typeof SessionStateSchema>;
