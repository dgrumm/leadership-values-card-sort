import { useId, useState, type ChangeEvent } from 'react';
import { validateConfig, type Deck, type GameConfig } from '@values-cards/shared';
import { Button } from '../../components/Button';
import { GameCard } from '../../components/GameCard';
import { parseDeckCsv, type DeckCsvError } from './parse-deck-csv';

export interface CustomDeckPanelProps {
  /** The rest of the config, so the largest-keep-count check can reuse
   *  `validateConfig`'s existing `KEEP_EXCEEDS_DECK_SIZE` rule (shared with 03.1's
   *  round editor) instead of a second copy of the comparison. */
  config: GameConfig;
  /** The currently active deck, if it's a custom one (i.e. not one of the bundled decks). */
  activeCustomDeck: Deck | null;
  onUse: (deck: Deck) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const PREVIEW_COUNT = 6;
const DEFAULT_NAME = 'Custom deck';

/** The `KEEP_EXCEEDS_DECK_SIZE` message, if swapping in `deck` would violate it — reruns
 *  the round editor's own rule rather than re-implementing the comparison. */
function keepExceedsDeckSize(config: GameConfig, deck: Deck): string | null {
  const result = validateConfig({ ...config, deck });
  if (result.ok) return null;
  return result.errors.find((error) => error.code === 'KEEP_EXCEEDS_DECK_SIZE')?.message ?? null;
}

/** Bring-your-own deck: paste or upload a CSV, preview it, and swap it into the config
 *  (03.2). Both input paths call the same `parseDeckCsv`, so they can never diverge. */
export function CustomDeckPanel({ config, activeCustomDeck, onUse, onRemove, disabled = false }: CustomDeckPanelProps) {
  const [text, setText] = useState('');
  const [name, setName] = useState(DEFAULT_NAME);
  const [errors, setErrors] = useState<DeckCsvError[]>([]);
  const [preview, setPreview] = useState<Deck | null>(null);
  const textareaId = useId();
  const fileId = useId();
  const nameId = useId();

  function parse(csvText: string, deckName: string) {
    if (csvText.trim() === '') {
      setErrors([]);
      setPreview(null);
      return;
    }
    const result = parseDeckCsv(csvText, deckName);
    if (!result.ok) {
      setErrors(result.errors);
      setPreview(null);
      return;
    }
    setErrors([]);
    setPreview(result.deck);
  }

  function handlePaste(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value);
    parse(event.target.value, name);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const defaultName = file.name.replace(/\.csv$/i, '').trim() || DEFAULT_NAME;
    const reader = new FileReader();
    reader.onload = () => {
      const fileText = typeof reader.result === 'string' ? reader.result : '';
      setName(defaultName);
      setText(fileText);
      parse(fileText, defaultName);
    };
    reader.readAsText(file);
  }

  const keepError = preview ? keepExceedsDeckSize(config, preview) : null;
  const nameValid = name.trim().length > 0;
  const canUse = preview !== null && !keepError && nameValid;

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="font-display text-lg font-semibold text-ink">Custom deck (CSV)</legend>

      {activeCustomDeck ? (
        <div className="flex items-center justify-between rounded-control border border-accent bg-accent-subtle p-4">
          <span className="text-sm font-semibold text-ink">
            Using "{activeCustomDeck.name}" ({activeCustomDeck.cards.length} cards)
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
            Remove custom deck
          </Button>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={textareaId}>
        Paste CSV (value,description)
        <textarea
          id={textareaId}
          value={text}
          onChange={handlePaste}
          disabled={disabled}
          rows={6}
          className="rounded-control border border-ink-muted panel-strong px-3 py-2 text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={fileId}>
        Or upload a CSV file
        <input id={fileId} type="file" accept=".csv" onChange={handleFile} disabled={disabled} />
      </label>

      {errors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={`${error.row}-${error.message}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-3 rounded-control border border-ink-muted panel-strong p-4">
          <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={nameId}>
            Deck name
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disabled}
              className="rounded-control border border-ink-muted panel-strong px-3 py-2 text-ink"
            />
          </label>
          <p className="text-sm text-ink-muted">{preview.cards.length} cards</p>
          <div className="flex flex-wrap gap-2">
            {preview.cards.slice(0, PREVIEW_COUNT).map((card, index) => (
              <div key={index} className="h-24 w-16 overflow-hidden">
                <div className="origin-top-left scale-[0.28]">
                  <GameCard title={card.value} description={card.description} />
                </div>
              </div>
            ))}
          </div>
          {keepError ? (
            <p role="alert" className="text-sm text-danger">
              {keepError}
            </p>
          ) : null}
          <Button type="button" onClick={() => onUse({ ...preview, name: name.trim() })} disabled={disabled || !canUse}>
            Use this deck
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
