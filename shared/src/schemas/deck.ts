import { z } from 'zod';

export const CardSchema = z.object({
  value: z.string().min(1),
  description: z.string().min(1),
});
export type Card = z.infer<typeof CardSchema>;

export const DeckSchema = z
  .object({
    name: z.string().min(1),
    cards: z.array(CardSchema).min(1).max(100),
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
