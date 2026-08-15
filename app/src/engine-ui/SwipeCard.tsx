import { motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useRef } from 'react';
import type { Card } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';
import type { FlipFrom } from '../components/GameCard';
import { transition, useMotionSafe } from '../theme/motion';

export interface SwipeCardProps {
  card: Card;
  onKeep: () => void;
  onDiscard: () => void;
  /**
   * False while the card is still face-down (01.5). Drag and ←/→ are inert until
   * it is turned over — you cannot judge a card you cannot read.
   */
  revealed?: boolean;
  /** Turns the face-down card over. Required whenever `revealed` is false. */
  onReveal?: () => void;
  /**
   * Fires when a commit animation *begins*, not when it resolves, so the deck can
   * flip the next card concurrently with this card's exit instead of after it.
   */
  onCommitStart?: (direction: 'keep' | 'discard') => void;
}

const SWIPE_DISTANCE_RATIO = 0.35;
const SWIPE_VELOCITY_THRESHOLD = 500;
const EXIT_DISTANCE = 500;
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 };

/**
 * The exit animation target for a committed swipe. Reduced motion drops the
 * x-translation entirely (fade only) — exported so this rule is unit
 * testable without depending on real animation-frame timing.
 */
export function swipeExitTarget(direction: 'keep' | 'discard', motionSafe: boolean) {
  if (!motionSafe) return { x: 0, opacity: 0 };
  const sign = direction === 'keep' ? 1 : -1;
  return { x: sign * EXIT_DISTANCE, opacity: 0 };
}

/**
 * Which way the next card turns over, given the decision just made (01.5).
 * Derived, never random: the same run of decisions always produces the same run
 * of flips, so the motion survives a refresh and reads as the deck answering the
 * participant rather than as noise.
 */
export function flipFromCommit(direction: 'keep' | 'discard'): FlipFrom {
  return direction === 'keep' ? 'right' : 'left';
}

/**
 * One draggable card: Framer Motion x-axis drag past threshold commits
 * keep/discard with a spring exit; under threshold springs back. Tap
 * (✗/✓ buttons) and keyboard (←/→) are equivalent commit paths, all routed
 * through the same exit animation.
 */
export function SwipeCard({
  card,
  onKeep,
  onDiscard,
  revealed = true,
  onReveal,
  onCommitStart,
}: SwipeCardProps) {
  const motionSafe = useMotionSafe();
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const controls = useAnimationControls();
  // Both the keydown handler and onDragEnd call commit() without awaiting, so
  // holding → could otherwise resolve two exits and count the same card twice.
  const committing = useRef(false);

  async function commit(direction: 'keep' | 'discard') {
    if (!revealed || committing.current) return;
    committing.current = true;
    onCommitStart?.(direction);
    await controls.start({ ...swipeExitTarget(direction, motionSafe), transition: transition(motionSafe, SPRING) });
    if (direction === 'keep') onKeep();
    else onDiscard();
  }

  async function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const width = containerRef.current?.offsetWidth ?? 256;
    const pastDistance = Math.abs(info.offset.x) > width * SWIPE_DISTANCE_RATIO;
    const pastVelocity = Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD;
    if (pastDistance || pastVelocity) {
      await commit(info.offset.x > 0 ? 'keep' : 'discard');
    } else {
      await controls.start({ x: 0, transition: transition(motionSafe, SPRING) });
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="group"
      // The value is in the accessible name from the moment this is the active
      // card, face-down or not — the flip is a visual affordance, never a gate
      // on assistive tech.
      aria-label={`${card.value} card`}
      className="flex flex-col items-center gap-4 rounded-card focus-visible:outline-none focus-visible:shadow-focus"
      onKeyDown={(event) => {
        if (!revealed) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onReveal?.();
          }
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          void commit('keep');
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          void commit('discard');
        }
      }}
    >
      <motion.div
        data-testid="swipe-card-drag"
        drag={revealed ? 'x' : false}
        dragElastic={0.6}
        dragMomentum={false}
        style={{ x, rotate }}
        animate={controls}
        onDragEnd={(event, info) => void handleDragEnd(event, info)}
        onClick={revealed ? undefined : onReveal}
        className={revealed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      >
        <GameCard title={card.value} description={card.description} flipped={!revealed} />
      </motion.div>
      {revealed ? (
        <div className="flex gap-4">
          <Button variant="danger" aria-label={`Discard ${card.value}`} onClick={() => void commit('discard')}>
            ✗
          </Button>
          <Button variant="primary" aria-label={`Keep ${card.value}`} onClick={() => void commit('keep')}>
            ✓
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={onReveal}>
          Turn over
        </Button>
      )}
    </div>
  );
}
