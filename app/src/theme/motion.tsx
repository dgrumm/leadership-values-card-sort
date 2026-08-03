import { createContext, useContext, type ReactNode } from 'react';
import { useReducedMotion, type Transition, type Variants } from 'framer-motion';

const MotionSafeContext = createContext<boolean | null>(null);

/** Resolves `prefers-reduced-motion` once and shares it down the tree. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const motionSafe = !useReducedMotion();
  return <MotionSafeContext.Provider value={motionSafe}>{children}</MotionSafeContext.Provider>;
}

/** True unless the user prefers reduced motion. Must be used within `MotionProvider`. */
export function useMotionSafe(): boolean {
  const value = useContext(MotionSafeContext);
  if (value === null) {
    throw new Error('useMotionSafe must be used within a MotionProvider');
  }
  return value;
}

const FADE: Transition = { duration: 0.15, ease: 'linear' };

/** Collapses a spring/slide transition to a plain opacity fade when reduced. */
export function transition(motionSafe: boolean, full: Transition): Transition {
  return motionSafe ? full : FADE;
}

/**
 * Strips every animatable key except `opacity` from each variant when
 * reduced, so transforms (rotate/scale/x/y) never animate — only fades do.
 */
export function fadeOnlyVariants(variants: Variants, motionSafe: boolean): Variants {
  if (motionSafe) return variants;
  const faded: Variants = {};
  for (const [key, value] of Object.entries(variants)) {
    const opacity = typeof value === 'object' && value !== null ? value.opacity : undefined;
    faded[key] = opacity === undefined ? {} : { opacity };
  }
  return faded;
}
