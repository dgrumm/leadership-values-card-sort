import { useState } from 'react';
import type { Card } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';
import { Sheet } from '../components/Sheet';

export interface KeptTrayProps {
  cards: Card[];
  limit: number | 'any';
  onDemote: (cardId: string) => void;
}

/** Persistent peek bar (kept count vs limit) expanding to a grid of kept cards. */
export function KeptTray({ cards, limit, onDemote }: KeptTrayProps) {
  const [open, setOpen] = useState(false);
  const overLimit = limit !== 'any' && cards.length > limit;
  const countLabel = limit === 'any' ? `${cards.length} kept` : `${cards.length} / ${limit} kept`;

  return (
    <div>
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-label={`Kept cards: ${countLabel}`}
        className={overLimit ? 'text-danger' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {countLabel}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        {/* `shrink-0` keeps Close pinned while the grid below scrolls — with a full tray the
            grid is taller than the sheet, and Close must never scroll out of reach. */}
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-ink">Kept</h2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 overflow-y-auto rounded-card border border-glass-edge bg-glass p-4 shadow-glass backdrop-blur-[var(--glass-blur)] sm:grid-cols-3">
          {cards.map((card) => (
            <div key={card.value} className="flex flex-col items-center gap-2">
              <GameCard title={card.value} description={card.description} />
              <Button variant="secondary" size="sm" onClick={() => onDemote(card.value)}>
                Demote
              </Button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
