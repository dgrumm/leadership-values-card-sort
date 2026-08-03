import type { Deck, GameConfig } from '@values-cards/shared';
import leadershipForty from '@values-cards/decks/decks/leadership-40.json';

/** `POST /api/session`'s default when no `config` is supplied — the classic 40 → 8 → 3 exercise. */
export const CLASSIC_TEMPLATE: GameConfig = {
  title: 'Leadership Values — 40 → 8 → 3',
  deck: leadershipForty as Deck,
  rounds: [
    { name: 'Narrow to 8', keep: 8, rank: false },
    { name: 'Final 3', keep: 3, rank: true },
  ],
  theme: { variant: 'default' },
  facilitated: true,
};
