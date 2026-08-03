import { z } from 'zod';
import { UuidSchema } from './common.js';
import { GameConfigSchema } from './config.js';
import { RevealSnapshotSchema, SessionStateSchema } from './session.js';

const intentId = { intentId: UuidSchema };
const participant = { participantId: UuidSchema };

export const IntentSchema = z.discriminatedUnion('type', [
  // `isCreator` is set by the DO after it verifies the caller's `creatorToken` HMAC — never
  // by the client. It is the sole source of the facilitator role (spec 01.1).
  z.strictObject({
    type: z.literal('join'),
    ...intentId,
    name: z.string().min(1),
    isCreator: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal('rejoin'), ...intentId, ...participant }),
  z.strictObject({ type: z.literal('updateConfig'), ...intentId, ...participant, config: GameConfigSchema }),
  z.strictObject({ type: z.literal('startGame'), ...intentId, ...participant }),
  z.strictObject({
    type: z.literal('reportProgress'),
    ...intentId,
    ...participant,
    round: z.number().int().nonnegative(),
    sorted: z.number().int().nonnegative(),
    kept: z.number().int().nonnegative(),
    done: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('reveal'),
    ...intentId,
    ...participant,
    round: z.number().int().nonnegative(),
    snapshot: RevealSnapshotSchema,
  }),
  z.strictObject({
    type: z.literal('unreveal'),
    ...intentId,
    ...participant,
    round: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('nudge'), ...intentId, ...participant, text: z.string().min(1) }),
  z.strictObject({
    type: z.literal('setGate'),
    ...intentId,
    ...participant,
    round: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('setSpotlight'),
    ...intentId,
    ...participant,
    target: z.union([UuidSchema, z.null()]),
  }),
  z.strictObject({ type: z.literal('conclude'), ...intentId, ...participant }),
]);
export type Intent = z.infer<typeof IntentSchema>;

export const EventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('state'), state: SessionStateSchema }),
  z.strictObject({ type: z.literal('patch'), patch: SessionStateSchema.partial() }),
  z.strictObject({ type: z.literal('nudge'), text: z.string().min(1) }),
  z.strictObject({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type Event = z.infer<typeof EventSchema>;
