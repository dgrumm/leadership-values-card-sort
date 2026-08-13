/**
 * A pack is a named set of custom-property *values* — surface treatment, canvas, field,
 * motion-relevant flags, type, shadow language, base palette. Component classes
 * (`.panel`, `.scrim`, Button/Toast/etc.) stay fixed and aesthetic-neutral; only the
 * values here change what they look like. This is the one TypeScript source of truth:
 * `packs/<name>.css` must set the same values on `:root`/`@theme` (packs.test.ts guards
 * the two staying in sync), and `tokens.test.ts` reads this object directly for the
 * per-pack AA gate (product invariant 6).
 *
 * Structural tokens (spacing, radius, z-index, type scale, durations, easings) are NOT
 * here — they live in `tokens.css` and are the same for every pack.
 */
export interface Pack {
  // Base palette
  colorSurface: string;
  colorSurfaceRaised: string;
  colorInk: string;
  colorInkMuted: string;
  colorAccent: string;
  colorAccentHover: string;
  colorAccentSubtle: string;
  colorOnAccent: string;
  colorDanger: string;
  colorSuccess: string;

  // Surface primitives consumed by `.panel` / `.panel-strong` / `.scrim` (tokens.css)
  panelBg: string;
  panelBgStrong: string;
  /** The whole `backdrop-filter` value — `blur(16px)` or `none`, not a bare radius. */
  panelBlur: string;
  panelBorder: string;
  scrimBg: string;
  /** The whole `backdrop-filter` value — `blur(16px)` or `none`, not a bare radius. */
  scrimBlur: string;

  // Shadow language
  shadowCard: string;
  shadowCardLifted: string;
  shadowSheet: string;
  shadowPanel: string;
  /**
   * Focus ring. The inner ring is always `var(--color-surface)` (tokens.css) so it
   * adapts automatically; this value is only the outer, accent-tinted ring — chosen
   * per pack so its composited-over-surface contrast is >= 3:1 (tokens.test.ts).
   */
  shadowFocusRing: string;

  // Full-page background field. A single CSS <image> value (or comma-separated list of
  // layers) — packs are free to use a different gradient shape entirely (linear drift vs
  // fixed radial blooms); the primitive (`body`, tokens.css) just paints whatever this is.
  // Static in every pack — no genre permits an animated full-canvas field.
  fieldImage: string;
  // Representative solid colors sampled from the field, for the AA compositing test.
  // Packs whose panels are fully opaque need only the canvas color (alpha erases the
  // field either way); a translucent-panel pack lists every stop the field can show.
  fieldStops: readonly string[];

  // Type
  fontDisplay: string;
  fontBody: string;

  // Avatar swatch: `oklch(${avatarLightness}% ${avatarChroma} <hue>)` computed at
  // runtime from participant data (Avatar.tsx) — the one color not read from a token,
  // so L/C are pack-supplied and validated across the full hue wheel here.
  avatarLightness: number;
  avatarChroma: number;
}

/** CSS custom-property name for every string-valued field above, in the same order. */
export const PACK_CSS_VARS: Record<
  Exclude<keyof Pack, 'fieldStops' | 'avatarLightness' | 'avatarChroma'>,
  string
> = {
  colorSurface: '--color-surface',
  colorSurfaceRaised: '--color-surface-raised',
  colorInk: '--color-ink',
  colorInkMuted: '--color-ink-muted',
  colorAccent: '--color-accent',
  colorAccentHover: '--color-accent-hover',
  colorAccentSubtle: '--color-accent-subtle',
  colorOnAccent: '--color-on-accent',
  colorDanger: '--color-danger',
  colorSuccess: '--color-success',
  panelBg: '--panel-bg',
  panelBgStrong: '--panel-bg-strong',
  panelBlur: '--panel-blur',
  panelBorder: '--panel-border',
  scrimBg: '--scrim-bg',
  scrimBlur: '--scrim-blur',
  shadowCard: '--shadow-card',
  shadowCardLifted: '--shadow-card-lifted',
  shadowSheet: '--shadow-sheet',
  shadowPanel: '--shadow-panel',
  shadowFocusRing: '--shadow-focus-ring',
  fieldImage: '--field-image',
  fontDisplay: '--font-display',
  fontBody: '--font-body',
};
