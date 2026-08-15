import { useEffect, useRef, useState } from 'react';
import type { Card } from '@values-cards/shared';
import { GameCard } from '../components/GameCard';
import type { FlipFrom } from '../components/GameCard';
import { SwipeCard } from './SwipeCard';
import { flipFromCommit } from './SwipeCard';

export interface CardStackProps {
  card: Card;
  nextCard?: Card;
  remaining: number;
  onKeep: () => void;
  onDiscard: () => void;
  /**
   * True when the round is being resumed mid-way (01.5). A refresh must never put
   * a face-down card in front of someone 22 cards deep (tenet 6, invariant 4);
   * someone who has sorted nothing has not begun, so face-down is right for them.
   */
  resumed?: boolean;
}

/**
 * How long the deck card waits before turning over, in seconds.
 *
 * The committed card sits directly on top of the deck card and takes ~120ms to
 * slide clear. Starting both at once technically overlaps them perfectly and
 * hides the entire flip behind the departing card — the turn has to begin as the
 * stage clears, not before. Still overlapping, so this is nothing like the
 * ~600ms serial cost of flipping only after the store advances.
 */
const FLIP_LEAD_SECONDS = 0.12;

/**
 * Static face-down cards drawn behind the one that turns over, and the step
 * between them.
 *
 * A one-card-deep deck has no stack: the single card behind the active one *is*
 * the card that flips, so the moment it turns the deck slot is empty and a
 * replacement pops in after the store advances. These backs give the deck
 * thickness, so the stack is continuous and the turning card's edge-on frames —
 * where `backface-visibility: hidden` leaves nothing to draw — land against a
 * card instead of against the page.
 */
const DECK_DEPTH = 2;

/**
 * Vertical step between stacked backs.
 *
 * Bounded by the control row, not by taste: the stack hangs
 * `DECK_STEP_PX * (DECK_DEPTH + 1)` below the active card, and `SwipeCard` puts
 * the ✗/✓ (or Turn over) row `gap-4` = 16px beneath it. So
 * `DECK_STEP_PX * (DECK_DEPTH + 1)` must stay under 16 or the deck bleeds under
 * the buttons — at a step of 8 it overhung them by 8px. Raising either constant
 * needs the other lowered, or more room below the card;
 * `e2e/sort-flip.spec.ts` fails if this stops holding.
 */
const DECK_STEP_PX = 4;

/** Current card centered, next card face-down beneath it, deck counter above. */
export function CardStack({ card, nextCard, remaining, onKeep, onDiscard, resumed = false }: CardStackProps) {
  const [revealed, setRevealed] = useState(resumed);
  // The direction of an in-flight commit, or null when the deck is at rest. Set
  // when the commit *starts* so the next card turns over during the outgoing
  // card's exit rather than after it — that overlap is what keeps a per-card
  // flip from taxing all 40 cards.
  const [pendingFlip, setPendingFlip] = useState<FlipFrom | null>(null);

  // The store advanced: the card the participant just watched turn over is now
  // the active card, already face-up at the same rotation, so the swap is
  // invisible and no second flip plays.
  //
  // Guarded on the *previous card value*, not a has-mounted flag: StrictMode
  // runs mount effects twice, and a has-mounted flag survives its
  // effect/cleanup/effect cycle, so the second pass would reveal the top card
  // before the participant ever touched it — the face-down state would work in
  // tests and silently not work in the browser. Comparing values is idempotent,
  // so double invocation is a no-op.
  // `remaining` counts the active card and everything under it, so the cards
  // below `nextCard` are `remaining - 2`. Near the bottom of the deck the stack
  // genuinely thins out, which is the honest thing to show.
  const backsBehind = Math.max(0, Math.min(DECK_DEPTH, remaining - 2));

  const prevCardRef = useRef(card.value);
  useEffect(() => {
    if (prevCardRef.current === card.value) return;
    prevCardRef.current = card.value;
    setPendingFlip(null);
    setRevealed(true);
  }, [card.value]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <p className="text-sm text-ink-muted">{remaining} left</p>
      <div className="relative">
        {/*
         * Deck thickness. Purely the stack's body — face-down, inert, and hidden
         * from assistive tech, which already gets the deck size from the counter
         * above. `title=""` is safe because a flipped card mounts no front face
         * at all (asserted in GameCard.test.tsx), so there is no content to read.
         */}
        {Array.from({ length: backsBehind }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-base flex justify-center"
            style={{ top: `${DECK_STEP_PX * (i + 2)}px` }}
          >
            <GameCard title="" flipped />
          </div>
        ))}
        {nextCard ? (
          // Named so the flip can be sampled without depending on DOM order —
          // the static backs above are also `[data-flipped]`.
          <div data-testid="deck-card" className="absolute inset-x-0 top-2 z-base flex justify-center">
            {/*
             * Keyed on the flip direction so a commit remounts this face with its
             * back pre-rotated the signed way, then animates to front. A back at
             * +180 and -180 are visually identical, so the remount is invisible
             * and it is the only way the leading edge can follow the decision.
             *
             * `initialFace="back"` is load-bearing: on this remount `flipped` is
             * already false, so without it the start state resolves to the front
             * and the card pops face-up with no rotation at all.
             */}
            <GameCard
              key={`${nextCard.value}:${pendingFlip ?? 'down'}`}
              title={nextCard.value}
              description={nextCard.description}
              flipped={pendingFlip === null}
              flipFrom={pendingFlip ?? 'right'}
              initialFace="back"
              flipDelay={pendingFlip === null ? 0 : FLIP_LEAD_SECONDS}
            />
          </div>
        ) : null}
        <div className="relative z-card">
          <SwipeCard
            key={card.value}
            card={card}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onCommitStart={(direction) => setPendingFlip(flipFromCommit(direction))}
            onKeep={onKeep}
            onDiscard={onDiscard}
          />
        </div>
      </div>
    </div>
  );
}
