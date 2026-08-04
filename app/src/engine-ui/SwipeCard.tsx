import { motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useRef } from 'react';
import type { Card } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';
import { transition, useMotionSafe } from '../theme/motion';

export interface SwipeCardProps {
  card: Card;
  onKeep: () => void;
  onDiscard: () => void;
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
 * One draggable card: Framer Motion x-axis drag past threshold commits
 * keep/discard with a spring exit; under threshold springs back. Tap
 * (✗/✓ buttons) and keyboard (←/→) are equivalent commit paths, all routed
 * through the same exit animation.
 */
export function SwipeCard({ card, onKeep, onDiscard }: SwipeCardProps) {
  const motionSafe = useMotionSafe();
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const controls = useAnimationControls();

  async function commit(direction: 'keep' | 'discard') {
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
      aria-label={`${card.value} card`}
      className="flex flex-col items-center gap-4 rounded-card focus-visible:outline-none focus-visible:shadow-focus"
      onKeyDown={(event) => {
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
        drag="x"
        dragElastic={0.6}
        dragMomentum={false}
        style={{ x, rotate }}
        animate={controls}
        onDragEnd={(event, info) => void handleDragEnd(event, info)}
        className="cursor-grab active:cursor-grabbing"
      >
        <GameCard title={card.value} description={card.description} />
      </motion.div>
      <div className="flex gap-4">
        <Button variant="danger" aria-label={`Discard ${card.value}`} onClick={() => void commit('discard')}>
          ✗
        </Button>
        <Button variant="primary" aria-label={`Keep ${card.value}`} onClick={() => void commit('keep')}>
          ✓
        </Button>
      </div>
    </div>
  );
}
