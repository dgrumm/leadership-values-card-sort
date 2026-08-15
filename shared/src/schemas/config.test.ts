import { describe, expect, it } from 'vitest';
import { GameConfigSchema } from './config.js';

// Architecture §12 risk: a session's whole GameConfig (including its deck) is one DO
// storage value, capped at 128KB. 03.2 lets facilitators bring a deck up to the
// 100-card schema maximum (00.2) — this proves that ceiling still fits comfortably
// even with generously long card text, not just short bundled-deck values.
describe('GameConfig serialized size (DO storage value limit)', () => {
  it('a 100-card custom deck keeps the serialized config under 128KB', () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({
      // 60/300 chars: well past any bundled deck's card text, short of anything a CSV
      // upload's row-level validation would consider unreasonable.
      value: `Value ${i} ${'x'.repeat(50)}`,
      description: `Description ${i} ${'y'.repeat(280)}`,
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
