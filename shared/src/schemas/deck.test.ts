import { describe, expect, it } from 'vitest';
import { CARD_DESCRIPTION_MAX, CARD_VALUE_MAX, DeckSchema } from './deck.js';

function deckOf(count: number) {
  return {
    name: 'Test deck',
    cards: Array.from({ length: count }, (_, i) => ({ value: `Card ${i}`, description: `Description ${i}` })),
  };
}

describe('DeckSchema', () => {
  it('accepts a valid deck', () => {
    expect(DeckSchema.safeParse(deckOf(3)).success).toBe(true);
  });

  it('rejects duplicate values (case-insensitive)', () => {
    const deck = { name: 'Test', cards: [{ value: 'Trust', description: 'a' }, { value: 'trust', description: 'b' }] };
    expect(DeckSchema.safeParse(deck).success).toBe(false);
  });

  it('rejects empty descriptions', () => {
    const deck = { name: 'Test', cards: [{ value: 'Trust', description: '' }] };
    expect(DeckSchema.safeParse(deck).success).toBe(false);
  });

  it('rejects 0 cards', () => {
    expect(DeckSchema.safeParse(deckOf(0)).success).toBe(false);
  });

  it('rejects 101 cards', () => {
    expect(DeckSchema.safeParse(deckOf(101)).success).toBe(false);
  });

  it('accepts exactly 100 cards', () => {
    expect(DeckSchema.safeParse(deckOf(100)).success).toBe(true);
  });

  it('accepts exactly 1 card', () => {
    expect(DeckSchema.safeParse(deckOf(1)).success).toBe(true);
  });

  // Card text is bounded so a custom deck (03.2) can't push SessionState past the DO's
  // 128KB storage value limit — see config.test.ts for the budget assertion.
  it('accepts card text exactly at the length ceilings', () => {
    const deck = {
      name: 'Test',
      cards: [{ value: 'a'.repeat(CARD_VALUE_MAX), description: 'b'.repeat(CARD_DESCRIPTION_MAX) }],
    };
    expect(DeckSchema.safeParse(deck).success).toBe(true);
  });

  it('rejects a value one character over the ceiling', () => {
    const deck = { name: 'Test', cards: [{ value: 'a'.repeat(CARD_VALUE_MAX + 1), description: 'b' }] };
    expect(DeckSchema.safeParse(deck).success).toBe(false);
  });

  it('rejects a description one character over the ceiling', () => {
    const deck = { name: 'Test', cards: [{ value: 'a', description: 'b'.repeat(CARD_DESCRIPTION_MAX + 1) }] };
    expect(DeckSchema.safeParse(deck).success).toBe(false);
  });

  // `name` is a display label, so `source` is what identifies a deck's origin: a custom
  // deck may legitimately be named after a bundled one.
  it('defaults source to bundled so the bundled deck JSONs need no field', () => {
    const parsed = DeckSchema.parse(deckOf(3));
    expect(parsed.source).toBe('bundled');
  });

  it('preserves an explicit custom source', () => {
    const parsed = DeckSchema.parse({ ...deckOf(3), source: 'custom' });
    expect(parsed.source).toBe('custom');
  });

  it('rejects an unknown source', () => {
    expect(DeckSchema.safeParse({ ...deckOf(3), source: 'imported' }).success).toBe(false);
  });
});
