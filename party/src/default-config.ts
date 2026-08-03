/** `POST /api/session`'s default when no `config` is supplied — the classic 40 → 8 → 3
 *  exercise. Defined once in `@values-cards/decks` (spec 03.1) so the server fallback
 *  and the create route's one-tap template can never drift apart. */
export { CLASSIC_TEMPLATE } from '@values-cards/decks/templates.js';
