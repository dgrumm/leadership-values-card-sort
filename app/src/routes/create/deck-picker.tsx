import { DeckSchema, type Deck } from '@values-cards/shared';
import leadershipForty from '@values-cards/decks/decks/leadership-40.json';
import extendedSeventyTwo from '@values-cards/decks/decks/extended-72.json';
import devTwelve from '@values-cards/decks/decks/dev-12.json';

/**
 * The three bundled decks (PRD §4.1). Custom CSV decks are 03.2.
 *
 * Parsed rather than cast: `source` defaults to `'bundled'`, and only an actual parse
 * applies that default — a cast would leave it `undefined` at runtime while the types
 * claimed otherwise.
 */
export const BUNDLED_DECKS: Deck[] = [leadershipForty, extendedSeventyTwo, devTwelve].map((deck) =>
  DeckSchema.parse(deck),
);

const PREVIEW_COUNT = 3;

export interface DeckPickerProps {
  decks?: Deck[];
  selected: Deck;
  onSelect: (deck: Deck) => void;
  disabled?: boolean;
}

/** Radio group over the bundled decks — card count + a first-cards preview per option. */
export function DeckPicker({ decks = BUNDLED_DECKS, selected, onSelect, disabled = false }: DeckPickerProps) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="font-display text-lg font-semibold text-ink">Deck</legend>
      <div className="flex flex-col gap-3 sm:flex-row">
        {decks.map((deck) => {
          const id = `deck-${deck.name}`;
          const isSelected = deck.name === selected.name;
          return (
            <label
              key={deck.name}
              htmlFor={id}
              className={`flex flex-1 cursor-pointer flex-col gap-1 rounded-control border p-4 ${isSelected ? 'border-accent bg-accent-subtle' : 'border-ink-muted panel-strong'}`}
            >
              <span className="flex items-center gap-2 font-semibold text-ink">
                <input id={id} type="radio" name="deck" checked={isSelected} onChange={() => onSelect(deck)} />
                {deck.name}
              </span>
              <span className="text-sm text-ink-muted">{deck.cards.length} cards</span>
              <span className="text-xs text-ink-muted">
                {deck.cards
                  .slice(0, PREVIEW_COUNT)
                  .map((card) => card.value)
                  .join(', ')}
                …
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
