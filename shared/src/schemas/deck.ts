import { z } from 'zod';

/**
 * Card text is bounded because a session's whole `SessionState` — config *and* every
 * reveal snapshot — is one Durable Object storage value, capped at 128KB
 * (architecture §12). Unbounded text let a single custom deck (03.2) blow that limit.
 *
 * 60/300 leaves ~4x headroom over the bundled decks, which peak at 15/88.
 */
export const CARD_VALUE_MAX = 60;
export const CARD_DESCRIPTION_MAX = 300;

export const CardSchema = z.object({
  value: z.string().min(1).max(CARD_VALUE_MAX),
  description: z.string().min(1).max(CARD_DESCRIPTION_MAX),
});
export type Card = z.infer<typeof CardSchema>;

export const DeckSchema = z
  .object({
    name: z.string().min(1),
    cards: z.array(CardSchema).min(1).max(100),
    /**
     * Where the deck came from. `name` is a display label (it seeds the game title and
     * renders in the lobby), so it can't double as identity — a custom deck named
     * "Dev 12" would otherwise be indistinguishable from the bundled one. Defaults to
     * `bundled` so the bundled deck JSONs need no field.
     */
    source: z.enum(['bundled', 'custom']).default('bundled'),
  })
  .superRefine((deck, ctx) => {
    const seen = new Set<string>();
    deck.cards.forEach((card, index) => {
      const key = card.value.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate card value (case-insensitive): "${card.value}"`,
          path: ['cards', index, 'value'],
        });
      }
      seen.add(key);
    });
  });
export type Deck = z.infer<typeof DeckSchema>;
