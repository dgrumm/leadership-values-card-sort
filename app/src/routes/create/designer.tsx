import { validateConfig, type GameConfig } from '@values-cards/shared';
import { DeckPicker } from './deck-picker';
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

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="game-title">
        Game title
        <input
          id="game-title"
          value={config.title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
          className="rounded-control border border-ink-muted glass-panel-strong px-3 py-2 text-ink"
        />
      </label>

      <DeckPicker selected={config.deck} onSelect={onDeckChange} disabled={disabled} />

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
