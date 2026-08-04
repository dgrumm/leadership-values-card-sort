import { motion } from 'framer-motion';
import { fadeOnlyVariants, transition, useMotionSafe } from '../theme/motion';

export interface GameCardProps {
  /** Value name shown on the front face, set in the display serif. */
  title: string;
  /** Short description shown beneath the title on the front face. */
  description?: string;
  /** Shows the card-back face instead of the front. */
  flipped?: boolean;
}

// Single canonical size everywhere (fits 390px mobile, caps at 256px on desktop).
const CARD_SIZE = 'w-[min(78vw,16rem)] aspect-[5/7]';

// Mirrors --spring-stiffness/--spring-damping in tokens.css (Framer Motion
// transitions take numbers, not CSS var strings).
const FLIP_SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 };

const FLIP_VARIANTS = {
  front: { rotateY: 0, opacity: 1 },
  back: { rotateY: 180, opacity: 1 },
};

/**
 * Pure presentational 5:7 portrait card. No drag/swipe/game logic — the sort
 * loop (01.3) composes those behaviors around this shell.
 *
 * ponytail: the face swaps the instant the flip starts rather than at the
 * rotation's 90° midpoint, so a motion-safe viewer briefly sees the new
 * face's content while the card is still edge-on. Upgrade to a true two-face
 * 3D flip (`backface-visibility: hidden` on stacked front/back layers) if
 * 01.3 needs the illusion to hold up under close inspection.
 */
export function GameCard({ title, description, flipped = false }: GameCardProps) {
  const motionSafe = useMotionSafe();
  const variants = fadeOnlyVariants(FLIP_VARIANTS, motionSafe);

  return (
    <motion.div
      data-flipped={flipped}
      className={`${CARD_SIZE} rounded-card glass-panel`}
      variants={variants}
      initial={flipped ? 'back' : 'front'}
      animate={flipped ? 'back' : 'front'}
      transition={transition(motionSafe, FLIP_SPRING)}
    >
      {flipped ? (
        <div className="flex h-full w-full items-center justify-center rounded-card bg-accent" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-card bg-glass-strong p-4 text-center">
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        </div>
      )}
    </motion.div>
  );
}
