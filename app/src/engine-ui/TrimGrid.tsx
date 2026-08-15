import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Card } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';

export interface TrimGridProps {
  /** The over-limit kept cards, in keep order. */
  cards: Card[];
  /** Card ids currently marked to cut, pending confirm. */
  cut: string[];
  limit: number;
  onToggleCut: (cardId: string) => void;
  onConfirm: () => void;
}

// Matches the sm:grid-cols-3 breakpoint below — only used for Up/Down arrow
// math, so it doesn't need to track every breakpoint exactly to be operable.
const GRID_COLUMNS = 3;

/**
 * Conditional phase of the sort flow (not a page): a responsive grid of the
 * over-limit kept cards, tap/Enter toggles a card as cut. Roving tabindex
 * keeps the whole grid on one Tab stop; arrow keys move focus within it.
 */
export function TrimGrid({ cards, cut, limit, onToggleCut, onConfirm }: TrimGridProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const prevCutRef = useRef(cut);

  useEffect(() => {
    const prev = prevCutRef.current;
    const added = cut.find((id) => !prev.includes(id));
    const removed = prev.find((id) => !cut.includes(id));
    if (added !== undefined) {
      setAnnouncement(`${added} cut`);
    } else if (removed !== undefined) {
      setAnnouncement(`${removed} restored`);
    }
    prevCutRef.current = cut;
  }, [cut]);

  const remainingToCut = Math.max(0, cards.length - cut.length - limit);
  const canConfirm = cards.length - cut.length <= limit;

  function moveFocus(nextIndex: number) {
    const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
    setFocusIndex(clamped);
    itemRefs.current[clamped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index + GRID_COLUMNS);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index - GRID_COLUMNS);
        break;
      default:
        break;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-6 text-ink">
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-2xl font-semibold">Trim to {limit}</h1>
        <p className="text-sm text-ink-muted">
          {remainingToCut > 0 ? `Cut ${remainingToCut} more` : `${cards.length - cut.length} kept — ready to continue`}
        </p>
      </div>
      <div
        role="list"
        className="grid grid-cols-2 gap-4 rounded-card panel p-4 sm:grid-cols-3"
      >
        {cards.map((card, index) => {
          const isCut = cut.includes(card.value);
          return (
            <button
              key={card.value}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="listitem"
              aria-pressed={isCut}
              aria-label={isCut ? `${card.value}, cut` : card.value}
              tabIndex={index === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onClick={() => onToggleCut(card.value)}
              className={`relative flex flex-col items-center gap-2 rounded-card focus-visible:outline-none focus-visible:shadow-focus ${isCut ? 'opacity-50' : ''}`}
            >
              <GameCard title={card.value} description={card.description} />
              {isCut ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 rounded-control bg-danger px-2 py-1 text-xs text-on-accent"
                >
                  ✂
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <Button onClick={onConfirm} disabled={!canConfirm}>
        Confirm
      </Button>
    </main>
  );
}
