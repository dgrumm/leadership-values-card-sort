import { describe, expect, it } from 'vitest';
import { DeckSchema } from './deck.js';

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
});
