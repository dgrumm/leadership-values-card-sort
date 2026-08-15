import { motion } from 'framer-motion';
import { fadeOnlyVariants, transition, useMotionSafe } from '../theme/motion';

/** Which edge leads as the card turns over. Derived from the commit direction (01.5). */
export type FlipFrom = 'left' | 'right';

export interface GameCardProps {
  /** Value name shown on the front face, set in the display serif. */
  title: string;
  /** Short description shown beneath the title on the front face. */
  description?: string;
  /** Shows the card-back face instead of the front. */
  flipped?: boolean;
  /** Which way the card turns. `right` = keep-side, `left` = discard-side. */
  flipFrom?: FlipFrom;
  /**
   * The face this card *mounts* on. Defaults to `flipped`.
   *
   * Set `initialFace="back"` with `flipped={false}` to mount face-down and turn
   * over on mount. Without this the two are conflated: a card that mounts already
   * targeting the front resolves its start state to the front too, and animates
   * from front to front — a face swap with no rotation at all.
   */
  initialFace?: 'front' | 'back';
  /**
   * Seconds to wait before the flip runs. Ignored under reduced motion.
   *
   * Exists so a caller can let something else clear the stage first — a flip
   * nobody can see is not a flip.
   */
  flipDelay?: number;
}

// Single canonical size everywhere (fits 390px mobile, caps at 256px on desktop).
const CARD_SIZE = 'w-[min(78vw,16rem)] aspect-[5/7]';

// Mirrors --spring-stiffness/--spring-damping in tokens.css (Framer Motion
// transitions take numbers, not CSS var strings).
const FLIP_SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 };

/**
 * The rotation target for a given face + direction. Exported so the
 * "`flipFrom` inverts the rotation sign" rule is unit-testable without
 * depending on real animation frames — the same pattern 01.3 used for
 * `swipeExitTarget`.
 */
export function flipTarget(flipped: boolean, flipFrom: FlipFrom = 'right') {
  if (!flipped) return { rotateY: 0 };
  return { rotateY: flipFrom === 'right' ? 180 : -180 };
}

/**
 * Pure presentational 5:7 portrait card. No drag/swipe/game logic — the sort
 * loop (01.3) composes those behaviors around this shell.
 *
 * True two-face flip (01.5): both faces are stacked with
 * `backface-visibility: hidden` and the back pre-rotated, so the face swaps at
 * the rotation's 90° midpoint rather than at flip start. Required once the back
 * carries real art (03.3's `cardBackArt`) — with a flat accent back the cheaper
 * single-face swap was invisible; with art it shows value text on a card that is
 * still turned away.
 *
 * The front face is mounted only when face-up, so a face-down card has no
 * front-face content in the DOM at all — that is what makes the peeking deck
 * card spoiler-proof rather than merely low-opacity. The back stays mounted
 * always; it is the face that must be present *during* the turn.
 */
export function GameCard({
  title,
  description,
  flipped = false,
  flipFrom = 'right',
  initialFace,
  flipDelay = 0,
}: GameCardProps) {
  const motionSafe = useMotionSafe();
  const variants = fadeOnlyVariants(
    {
      front: { ...flipTarget(false), opacity: 1 },
      back: { ...flipTarget(true, flipFrom), opacity: 1 },
    },
    motionSafe,
  );
  const flipTransition = transition(motionSafe, FLIP_SPRING);

  return (
    // Perspective lives on the wrapper: on the rotating element itself it would
    // be re-applied every frame against a moving transform origin. The wrapper
    // carries no size — the rotating element stays the measured card box, so the
    // one canonical size and the 5:7 aspect are still asserted on `[data-flipped]`.
    <div style={{ perspective: 'var(--card-perspective)' }}>
      <motion.div
        data-flipped={flipped}
        className={`${CARD_SIZE} relative rounded-card`}
        style={{ transformStyle: 'preserve-3d' }}
        variants={variants}
        initial={(initialFace ?? (flipped ? 'back' : 'front')) === 'back' ? 'back' : 'front'}
        animate={flipped ? 'back' : 'front'}
        // A delay is only meaningful for real spatial motion; under reduced
        // motion the flip is already a ≤150ms crossfade and must not be held back.
        transition={motionSafe && flipDelay > 0 ? { ...flipTransition, delay: flipDelay } : flipTransition}
      >
        {/*
         * Back face. A single element by contract — 03.3 paints facilitator
         * `cardBackArt` here without restructuring the stack. Pre-rotated so it
         * faces the viewer when the container is turned over.
         */}
        <div
          data-testid="card-back"
          aria-hidden="true"
          className="card-face glass-panel bg-accent"
          style={{ transform: 'rotateY(180deg)' }}
        />
        {flipped ? null : (
          <div
            data-testid="card-front"
            className="card-face glass-panel-strong flex flex-col items-center justify-center gap-2 p-4 text-center"
          >
            <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
            {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
          </div>
        )}
      </motion.div>
    </div>
  );
}
