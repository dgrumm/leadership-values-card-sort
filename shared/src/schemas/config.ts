import { z } from 'zod';
import { DeckSchema } from './deck.js';

/** Minimal theme surface for 00.2; palette fields land in 03.3. */
export const ThemeConfigSchema = z.object({
  variant: z.string().min(1),
});
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const RoundConfigSchema = z.object({
  name: z.string().min(1),
  keep: z.union([z.number().int().positive(), z.literal('any')]),
  rank: z.boolean(),
});
export type RoundConfig = z.infer<typeof RoundConfigSchema>;

/**
 * `'any'` keep and `rank: true` are only meaningful relative to a round's
 * position in the whole sequence, so they're enforced here (custom issue
 * `params.code`) rather than on RoundConfigSchema in isolation.
 */
export const GameConfigSchema = z
  .object({
    title: z.string().min(1),
    deck: DeckSchema,
    rounds: z.array(RoundConfigSchema),
    theme: ThemeConfigSchema,
    facilitated: z.boolean(),
  })
  .superRefine((config, ctx) => {
    const { rounds, deck } = config;

    if (rounds.length < 1 || rounds.length > 6) {
      ctx.addIssue({
        code: 'custom',
        message: 'a game must have between 1 and 6 rounds',
        path: ['rounds'],
        params: { code: 'INVALID_ROUND_COUNT' },
      });
    }

    let previousKeep: number | null = null;
    rounds.forEach((round, index) => {
      if (round.keep === 'any' && index !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: "keep: 'any' is only allowed on round 1",
          path: ['rounds', index, 'keep'],
          params: { code: 'ANY_OUTSIDE_FIRST_ROUND' },
        });
      }
      if (round.rank && index !== rounds.length - 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'rank: true is only allowed on the final round',
          path: ['rounds', index, 'rank'],
          params: { code: 'RANK_OUTSIDE_FINAL_ROUND' },
        });
      }
      if (typeof round.keep === 'number') {
        if (round.keep > deck.cards.length) {
          ctx.addIssue({
            code: 'custom',
            message: `round "${round.name}" keeps ${round.keep} but the deck has only ${deck.cards.length} cards`,
            path: ['rounds', index, 'keep'],
            params: { code: 'KEEP_EXCEEDS_DECK_SIZE' },
          });
        }
        if (previousKeep !== null && round.keep >= previousKeep) {
          ctx.addIssue({
            code: 'custom',
            message: 'numeric keep-counts must strictly decrease round over round',
            path: ['rounds', index, 'keep'],
            params: { code: 'KEEP_NOT_STRICTLY_DECREASING' },
          });
        }
        previousKeep = round.keep;
      }
    });
  });
export type GameConfig = z.infer<typeof GameConfigSchema>;
