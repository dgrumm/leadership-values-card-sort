import type { Deck, GameConfig } from '@values-cards/shared';
import leadershipForty from './decks/leadership-40.json';

/**
 * The one bundled template for 2.0 (PRD §4.1, spec 03.1) — the classic
 * "Leadership Values — 40 → 8 → 3" exercise. Shared by the create route's
 * one-tap default and the server's `POST /api/session` fallback so the two
 * can never drift apart (party/src/default-config.ts re-exports this).
 */
export const CLASSIC_TEMPLATE: GameConfig = {
  title: 'Leadership Values — 40 → 8 → 3',
  deck: leadershipForty as Deck,
  rounds: [
    { name: 'Open triage', keep: 'any', rank: false },
    { name: 'Top 8', keep: 8, rank: false },
    { name: 'Top 3', keep: 3, rank: true },
  ],
  theme: { variant: 'default' },
  facilitated: true,
};
