import type { Pack } from './types';

// 5-stop pastel field. Static (00.6 removes the 28s drift animation for every pack —
// no genre permits an animated full-canvas mesh gradient); the gradient shape itself
// is unchanged from 00.4/00.5, just no longer animated.
const FIELD_STOPS = ['#fbe4d8', '#fbdce6', '#e9def8', '#dcecfb', '#dcf3e6'] as const;

/**
 * The pre-00.6 look, unchanged apart from freezing the field and correcting the avatar
 * swatch's lightness/chroma (the old `oklch(55% 0.12 <hue>)` failed AA against white
 * text at hue ~192 — not a behavioral no-op, a pre-existing bug this spec's per-hue
 * gate caught; see the loop's final report for the full note).
 */
export const tactileWarm: Pack = {
  colorSurface: '#faf6ee',
  colorSurfaceRaised: '#ffffff',
  colorInk: '#26201b',
  colorInkMuted: '#6b5f54',
  colorAccent: '#a8461f',
  colorAccentHover: '#8f3a19',
  colorAccentSubtle: '#f2ddce',
  colorOnAccent: '#ffffff',
  colorDanger: '#b3261e',
  colorSuccess: '#2e6b3e',

  panelBg: 'rgb(255 255 255 / 55%)',
  panelBgStrong: 'rgb(255 255 255 / 80%)',
  panelBlur: 'blur(16px)',
  panelBorder: 'rgb(255 255 255 / 65%)',
  scrimBg: 'rgb(38 32 27 / 40%)',
  scrimBlur: 'blur(16px)',

  shadowCard: '0 1px 2px rgb(38 32 27 / 0.06), 0 4px 10px rgb(38 32 27 / 0.08)',
  shadowCardLifted: '0 4px 8px rgb(38 32 27 / 0.1), 0 12px 24px rgb(38 32 27 / 0.14)',
  shadowSheet: '0 -4px 12px rgb(38 32 27 / 0.08), 0 -16px 40px rgb(38 32 27 / 0.16)',
  shadowPanel: '0 8px 32px rgb(38 32 27 / 0.14), inset 0 1px 0 rgb(255 255 255 / 60%)',
  shadowFocusRing: 'rgb(168 70 31 / 75%)',

  fieldImage: `linear-gradient(120deg, ${FIELD_STOPS[0]}, ${FIELD_STOPS[1]}, ${FIELD_STOPS[2]}, ${FIELD_STOPS[3]}, ${FIELD_STOPS[4]}, ${FIELD_STOPS[0]})`,
  fieldStops: FIELD_STOPS,

  fontDisplay: "'Fraunces', ui-serif, Georgia, serif",
  fontBody: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",

  avatarLightness: 50,
  avatarChroma: 0.08,
};
