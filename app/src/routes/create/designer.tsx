import { useState } from 'react';
import { validateConfig, type Deck, type GameConfig } from '@values-cards/shared';
import { BUNDLED_DECKS, DeckPicker } from './deck-picker';
import { CustomDeckPanel } from './custom-deck-panel';
import { RoundEditor } from './round-editor';

export interface DesignerProps {
  config: GameConfig;
  onTitleChange: (title: string) => void;
  onDeckChange: (deck: GameConfig['deck']) => void;
  onRoundsChange: (rounds: GameConfig['rounds']) => void;
  onFacilitatedChange: (facilitated: boolean) => void;
  disabled?: boolean;
}

/** The full designer surface: title, deck, rounds, facilitation. The one source of
 *  truth for "is this config good enough to create/save" is `validateConfig` (00.2) —
 *  this component never duplicates its rules. */
export function Designer({
  config,
  onTitleChange,
  onDeckChange,
  onRoundsChange,
  onFacilitatedChange,
  disabled = false,
}: DesignerProps) {
  const result = validateConfig(config);
  const errors = result.ok ? [] : result.errors;

  // `source` rather than the name: a facilitator may legitimately name their CSV deck
  // "Dev 12", and the name is a display label (it seeds the game title). Tracking the
  // last bundled deck picked is what "remove custom deck" reverts to.
  const isCustomDeck = config.deck.source === 'custom';
  const [lastBundledDeck, setLastBundledDeck] = useState<Deck>(
    () => BUNDLED_DECKS.find((deck) => deck.name === config.deck.name) ?? BUNDLED_DECKS[0]!,
  );

  function handleBundledSelect(deck: Deck) {
    setLastBundledDeck(deck);
    onDeckChange(deck);
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="game-title">
        Game title
        <input
          id="game-title"
          value={config.title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
          className="rounded-control border border-ink-muted panel-strong px-3 py-2 text-ink"
        />
      </label>

      <DeckPicker selected={config.deck} onSelect={handleBundledSelect} disabled={disabled} />

      <CustomDeckPanel
        config={config}
        activeCustomDeck={isCustomDeck ? config.deck : null}
        onUse={onDeckChange}
        onRemove={() => onDeckChange(lastBundledDeck)}
        disabled={disabled}
      />

      <RoundEditor
        rounds={config.rounds}
        deckSize={config.deck.cards.length}
        errors={errors}
        onChange={onRoundsChange}
        disabled={disabled}
      />

      <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="facilitation-toggle">
        <input
          id="facilitation-toggle"
          type="checkbox"
          checked={config.facilitated}
          onChange={(event) => onFacilitatedChange(event.target.checked)}
          disabled={disabled}
        />
        Facilitation mode (you are the facilitator)
      </label>
    </div>
  );
}
