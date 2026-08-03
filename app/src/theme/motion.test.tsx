import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: vi.fn() };
});

import { useReducedMotion } from 'framer-motion';
import { MotionProvider, fadeOnlyVariants, transition, useMotionSafe } from './motion';

afterEach(cleanup);

function Probe() {
  const motionSafe = useMotionSafe();
  return <div>{motionSafe ? 'safe' : 'reduced'}</div>;
}

describe('MotionProvider / useMotionSafe', () => {
  it('reports motion-safe when the user has no reduced-motion preference', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByText('safe')).toBeDefined();
  });

  it('reports reduced when the user prefers reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByText('reduced')).toBeDefined();
  });

  it('throws outside a MotionProvider', () => {
    // Suppress React's expected error-boundary console noise for this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useMotionSafe must be used within a MotionProvider');
    spy.mockRestore();
  });
});

describe('transition()', () => {
  const spring = { type: 'spring' as const, stiffness: 420, damping: 32 };

  it('returns the full spring transition when motion-safe', () => {
    expect(transition(true, spring)).toEqual(spring);
  });

  it('collapses to a plain fade when reduced', () => {
    const reduced = transition(false, spring);
    expect(reduced).not.toHaveProperty('type', 'spring');
    expect(reduced).toEqual({ duration: 0.15, ease: 'linear' });
  });
});

describe('fadeOnlyVariants()', () => {
  const variants = {
    hidden: { opacity: 0, y: 20, rotateY: 90 },
    visible: { opacity: 1, y: 0, rotateY: 0 },
  };

  it('passes variants through unchanged when motion-safe', () => {
    expect(fadeOnlyVariants(variants, true)).toEqual(variants);
  });

  it('strips every transform key, keeping only opacity, when reduced', () => {
    const reduced = fadeOnlyVariants(variants, false);
    expect(reduced).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    });
    for (const variant of Object.values(reduced)) {
      expect(variant).not.toHaveProperty('y');
      expect(variant).not.toHaveProperty('rotateY');
    }
  });
});
