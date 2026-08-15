import { describe, expect, it } from 'vitest';
import { validateConfig } from './validate-config.js';
import type { Deck } from '../schemas/deck.js';
import type { RoundConfig } from '../schemas/config.js';

function deckOf(count: number): Deck {
  return {
    name: 'Deck',
    cards: Array.from({ length: count }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
    source: 'bundled',
  };
}

interface RawConfig {
  title: string;
  deck: Deck;
  rounds: RoundConfig[];
  theme: { variant: string };
  facilitated: boolean;
}

function baseConfig(overrides: Partial<RawConfig> = {}): RawConfig {
  return {
    title: 'Test game',
    deck: deckOf(40),
    rounds: [
      { name: 'Round 1', keep: 8, rank: false },
      { name: 'Round 2', keep: 3, rank: true },
    ],
    theme: { variant: 'default' },
    facilitated: true,
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const result = validateConfig(baseConfig());
    expect(result.ok).toBe(true);
  });

  it('rejects non-decreasing keeps', () => {
    const result = validateConfig(
      baseConfig({
        rounds: [
          { name: 'Round 1', keep: 8, rank: false },
          { name: 'Round 2', keep: 8, rank: true },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'KEEP_NOT_STRICTLY_DECREASING')).toBe(true);
  });

  it('rejects keep > deck size', () => {
    const result = validateConfig(
      baseConfig({
        deck: deckOf(5),
        rounds: [{ name: 'Round 1', keep: 8, rank: true }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'KEEP_EXCEEDS_DECK_SIZE')).toBe(true);
  });

  it('rejects 0 rounds', () => {
    const result = validateConfig(baseConfig({ rounds: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'INVALID_ROUND_COUNT')).toBe(true);
  });

  it('rejects more than 6 rounds', () => {
    const rounds = Array.from({ length: 7 }, (_, i) => ({ name: `Round ${i + 1}`, keep: 40 - i, rank: i === 6 }));
    const result = validateConfig(baseConfig({ rounds }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'INVALID_ROUND_COUNT')).toBe(true);
  });

  it("rejects keep: 'any' outside round 1", () => {
    const result = validateConfig(
      baseConfig({
        rounds: [
          { name: 'Round 1', keep: 8, rank: false },
          { name: 'Round 2', keep: 'any', rank: true },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'ANY_OUTSIDE_FIRST_ROUND')).toBe(true);
  });

  it("accepts keep: 'any' on round 1", () => {
    const result = validateConfig(
      baseConfig({
        rounds: [
          { name: 'Round 1', keep: 'any', rank: false },
          { name: 'Round 2', keep: 3, rank: true },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects rank: true outside the final round', () => {
    const result = validateConfig(
      baseConfig({
        rounds: [
          { name: 'Round 1', keep: 8, rank: true },
          { name: 'Round 2', keep: 3, rank: false },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'RANK_OUTSIDE_FINAL_ROUND')).toBe(true);
  });

  it('round-trips the classic template (Leadership 40 -> 8 -> 3, ranked final)', () => {
    const classic = baseConfig({
      title: 'Leadership Values',
      rounds: [
        { name: 'First cut', keep: 8, rank: false },
        { name: 'Final three', keep: 3, rank: true },
      ],
    });
    const result = validateConfig(classic);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.rounds.map((r) => r.keep)).toEqual([8, 3]);
      expect(result.config.deck.cards).toHaveLength(40);
      expect(result.config.rounds.at(-1)?.rank).toBe(true);
    }
  });
});
