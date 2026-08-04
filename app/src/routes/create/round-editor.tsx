import type { ConfigError, RoundConfig } from '@values-cards/shared';
import { Button } from '../../components/Button';

const MAX_ROUNDS = 6;
const MIN_ROUNDS = 1;

export interface RoundEditorProps {
  rounds: RoundConfig[];
  deckSize: number;
  errors: ConfigError[];
  onChange: (rounds: RoundConfig[]) => void;
  disabled?: boolean;
}

function errorsAt(errors: ConfigError[], index: number, field: 'keep' | 'rank'): ConfigError[] {
  return errors.filter((error) => error.path[0] === 'rounds' && error.path[1] === index && error.path[2] === field);
}

/** New round's keep-count defaults just under the previous round's, clamped to the deck. */
function defaultKeepFor(previous: RoundConfig | undefined, deckSize: number): number {
  const previousKeep = typeof previous?.keep === 'number' ? previous.keep : deckSize;
  return Math.max(1, Math.min(deckSize, previousKeep - 1));
}

/**
 * Round add/remove/edit — the whole surface is driven by `validateConfig`'s errors
 * (00.2), never a parallel set of UI-only rules (tenet 4). One row per round; round 1
 * alone gets the "keep any" toggle, the last round alone gets the rank toggle, exactly
 * mirroring `GameConfigSchema`'s cross-field refinements.
 */
export function RoundEditor({ rounds, deckSize, errors, onChange, disabled = false }: RoundEditorProps) {
  const roundCountErrors = errors.filter((error) => error.path.length === 1 && error.path[0] === 'rounds');

  function updateRound(index: number, patch: Partial<RoundConfig>) {
    onChange(rounds.map((round, i) => (i === index ? { ...round, ...patch } : round)));
  }

  function addRound() {
    if (rounds.length >= MAX_ROUNDS) return;
    const previous = rounds[rounds.length - 1];
    onChange([...rounds, { name: `Round ${rounds.length + 1}`, keep: defaultKeepFor(previous, deckSize), rank: false }]);
  }

  function removeRound(index: number) {
    if (rounds.length <= MIN_ROUNDS) return;
    onChange(rounds.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <legend className="font-display text-lg font-semibold text-ink">Rounds</legend>
      <div aria-live="polite" className="flex flex-col gap-4">
        {roundCountErrors.length > 0 ? (
          <p role="alert" className="text-sm text-danger">
            {roundCountErrors[0]?.message}
          </p>
        ) : null}
        {rounds.map((round, index) => {
          const isFirst = index === 0;
          const isLast = index === rounds.length - 1;
          const keepErrors = errorsAt(errors, index, 'keep');
          const rankErrors = errorsAt(errors, index, 'rank');
          const keepAny = round.keep === 'any';

          return (
            <div key={index} className="flex flex-col gap-2 rounded-control border border-ink-muted glass-panel-strong p-4">
              <div className="flex items-end gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm font-semibold" htmlFor={`round-${index}-name`}>
                  Round {index + 1} name
                  <input
                    id={`round-${index}-name`}
                    value={round.name}
                    onChange={(event) => updateRound(index, { name: event.target.value })}
                    className="rounded-control border border-ink-muted glass-panel-strong px-3 py-2 text-ink"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRound(index)}
                  disabled={disabled || rounds.length <= MIN_ROUNDS}
                  aria-label={`Remove round ${index + 1}`}
                >
                  Remove
                </Button>
              </div>

              {isFirst ? (
                <label className="flex items-center gap-2 text-sm font-semibold" htmlFor={`round-${index}-keep-any`}>
                  <input
                    id={`round-${index}-keep-any`}
                    type="checkbox"
                    checked={keepAny}
                    onChange={(event) =>
                      updateRound(index, { keep: event.target.checked ? 'any' : defaultKeepFor(undefined, deckSize) })
                    }
                  />
                  Keep any (open triage)
                </label>
              ) : null}

              {!keepAny ? (
                <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={`round-${index}-keep`}>
                  Keep count
                  <input
                    id={`round-${index}-keep`}
                    type="number"
                    min={1}
                    value={typeof round.keep === 'number' ? round.keep : ''}
                    onChange={(event) => updateRound(index, { keep: Number(event.target.value) || 0 })}
                    aria-describedby={keepErrors.length > 0 ? `round-${index}-keep-error` : undefined}
                    aria-invalid={keepErrors.length > 0}
                    className="w-32 rounded-control border border-ink-muted glass-panel-strong px-3 py-2 text-ink"
                  />
                </label>
              ) : null}
              {keepErrors.length > 0 ? (
                <p id={`round-${index}-keep-error`} className="text-sm text-danger">
                  {keepErrors[0]?.message}
                </p>
              ) : null}

              {isLast ? (
                <label className="flex items-center gap-2 text-sm font-semibold" htmlFor={`round-${index}-rank`}>
                  <input
                    id={`round-${index}-rank`}
                    type="checkbox"
                    checked={round.rank}
                    onChange={(event) => updateRound(index, { rank: event.target.checked })}
                    aria-describedby={rankErrors.length > 0 ? `round-${index}-rank-error` : undefined}
                  />
                  Rank final results
                </label>
              ) : null}
              {rankErrors.length > 0 ? (
                <p id={`round-${index}-rank-error`} className="text-sm text-danger">
                  {rankErrors[0]?.message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={addRound} disabled={disabled || rounds.length >= MAX_ROUNDS}>
        Add round
      </Button>
    </fieldset>
  );
}
