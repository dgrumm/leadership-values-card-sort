import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeckSchema } from '@values-cards/shared';

const DECKS_DIR = join(import.meta.dirname, 'decks');

const bundledDecks = [
  { file: 'leadership-40.json', expectedCards: 40 },
  { file: 'extended-72.json', expectedCards: 72 },
  { file: 'dev-12.json', expectedCards: 12 },
];

describe('bundled decks', () => {
  for (const { file, expectedCards } of bundledDecks) {
    it(`${file} parses as a valid deck with ${expectedCards} cards`, () => {
      const raw = JSON.parse(readFileSync(join(DECKS_DIR, file), 'utf8'));
      const result = DeckSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cards).toHaveLength(expectedCards);
      }
    });
  }
});
