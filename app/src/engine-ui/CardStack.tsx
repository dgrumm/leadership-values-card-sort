import type { Card } from '@values-cards/shared';
import { GameCard } from '../components/GameCard';
import { SwipeCard } from './SwipeCard';

export interface CardStackProps {
  card: Card;
  nextCard?: Card;
  remaining: number;
  onKeep: () => void;
  onDiscard: () => void;
}

/** Current card centered, next card peeking beneath it, deck counter above. */
export function CardStack({ card, nextCard, remaining, onKeep, onDiscard }: CardStackProps) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      <p className="text-sm text-ink-muted">{remaining} left</p>
      <div className="relative">
        {nextCard ? (
          <div className="absolute inset-x-0 top-2 z-base flex justify-center opacity-60">
            <GameCard title={nextCard.value} description={nextCard.description} />
          </div>
        ) : null}
        <div className="relative z-card">
          <SwipeCard key={card.value} card={card} onKeep={onKeep} onDiscard={onDiscard} />
        </div>
      </div>
    </div>
  );
}
