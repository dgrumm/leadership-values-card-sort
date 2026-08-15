import { describe, expect, it } from 'vitest';
import { GameConfigSchema } from './config.js';
import { CARD_DESCRIPTION_MAX, CARD_VALUE_MAX } from './deck.js';

// Architecture §12 risk: a session's whole GameConfig (including its deck) is one DO
// storage value, capped at 128KB. 03.2 lets facilitators bring a deck up to the
// 100-card schema maximum (00.2) — with CARD_VALUE_MAX/CARD_DESCRIPTION_MAX now bounding
// card text, this is a true worst case: the largest deck the schema can represent at all.
describe('GameConfig serialized size (DO storage value limit)', () => {
  it('the largest schema-representable deck keeps the serialized config under 128KB', () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({
      // Exactly at the schema ceiling, and unique per card so the duplicate-value
      // refinement still passes.
      value: `${i}`.padEnd(CARD_VALUE_MAX, 'x'),
      description: `${i}`.padEnd(CARD_DESCRIPTION_MAX, 'y'),
    }));
    const config = {
      title: 'Stress test',
      deck: { name: 'Custom deck', cards },
      rounds: [
        { name: 'Narrow', keep: 8, rank: false },
        { name: 'Final', keep: 3, rank: true },
      ],
      theme: { variant: 'default' },
      facilitated: true,
    };

    const parsed = GameConfigSchema.parse(config);
    const bytes = new TextEncoder().encode(JSON.stringify(parsed)).length;
    expect(bytes).toBeLessThan(128 * 1024);
  });
});
