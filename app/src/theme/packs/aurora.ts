import type { Pack } from './types';

/**
 * Atmospheric genre: dark canvas, one warm accent hue, no glassmorphism (panel-blur:
 * 0px), fade-only motion (handled by motion.tsx, not a pack concern), up to two fixed
 * radial blooms, elevation by lightness rather than shadow (shadowCard/-Lifted/Sheet
 * stay near-invisible; the raised-surface color doing the work), no hairlines
 * (panelBorder fully transparent). CTAs stay accent-filled pills — this is a
 * multiplayer tool with real controls, not a marketing page, so app chrome wins over
 * the genre's typographic-only-button guidance where the two conflict.
 */
export const aurora: Pack = {
  colorSurface: '#14120f',
  colorSurfaceRaised: '#201c17',
  colorInk: '#f3ede3',
  colorInkMuted: '#a89c8d',
  colorAccent: '#e2793a',
  colorAccentHover: '#ea8c52',
  colorAccentSubtle: '#3a2a1c',
  colorOnAccent: '#1a1008',
  colorDanger: '#ff8a75',
  colorSuccess: '#7fd99a',

  // No glassmorphism: panelBlur is 0, panelBorder is transparent (no hairlines).
  // panel-strong is a hair lighter than panel — "elevation by lightness".
  panelBg: '#201c17',
  panelBgStrong: '#2a231c',
  panelBlur: 'none',
  panelBorder: 'rgb(0 0 0 / 0%)',
  scrimBg: 'rgb(0 0 0 / 70%)',
  scrimBlur: 'none',

  // Elevation by lightness, not shadow — kept near-invisible rather than removed
  // outright, since `.panel`'s box-shadow: var(--shadow-panel) still runs.
  shadowCard: '0 1px 2px rgb(0 0 0 / 0.3)',
  shadowCardLifted: '0 2px 4px rgb(0 0 0 / 0.35)',
  shadowSheet: '0 -2px 6px rgb(0 0 0 / 0.35)',
  shadowPanel: 'none',
  shadowFocusRing: 'rgb(226 121 58 / 70%)',

  // Up to two fixed radial blooms at ~20-30% footprint, no animation.
  fieldImage:
    'radial-gradient(circle at 20% 20%, rgb(226 121 58 / 16%), transparent 55%), ' +
    'radial-gradient(circle at 82% 78%, rgb(226 121 58 / 10%), transparent 50%)',
  // Panels here are fully opaque, so the field never shows through one — the canvas
  // color is the only stop that matters for the compositing AA test.
  fieldStops: ['#14120f'],

  fontDisplay: "'Geist Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontBody: "'Geist Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",

  avatarLightness: 75,
  avatarChroma: 0.1,
};
