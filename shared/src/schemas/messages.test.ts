import { describe, expect, it } from 'vitest';
import { IntentSchema, EventSchema } from './messages.js';

const PARTICIPANT = '22222222-2222-4222-8222-222222222222';

describe('reportProgress cannot smuggle card data', () => {
  it('has no field that can hold card contents', () => {
    const valid = {
      type: 'reportProgress',
      intentId: '11111111-1111-4111-8111-111111111111',
      participantId: PARTICIPANT,
      round: 1,
      sorted: 1,
      kept: 1,
      done: false,
    };
    expect(IntentSchema.safeParse(valid).success).toBe(true);

    const smuggled = { ...valid, cards: [{ value: 'Trust', description: 'x' }] };
    expect(IntentSchema.safeParse(smuggled).success).toBe(false);
  });
});

describe('Event schemas cannot smuggle unexpected data', () => {
  it('rejects a nudge event with a smuggled cards field', () => {
    const smuggled = { type: 'nudge', text: 'hi', cards: [{ value: 'Trust', description: 'x' }] };
    expect(EventSchema.safeParse(smuggled).success).toBe(false);
  });

  it('rejects an error event with a smuggled cards field', () => {
    const smuggled = { type: 'error', code: 'X', message: 'y', cards: [] };
    expect(EventSchema.safeParse(smuggled).success).toBe(false);
  });
});
