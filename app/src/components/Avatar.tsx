import { activePack } from '../theme/packs';

export interface AvatarProps {
  name: string;
  /** Hue angle (0-360) driving the swatch color — stable per participant. */
  hue: number;
}

/**
 * Renders a participant's initial on an OKLCH swatch derived from their
 * assigned hue. The hue is per-participant data, not a design token, so the
 * color here is computed rather than pulled from `@theme`. Lightness/chroma
 * ARE pack-supplied (00.6) — the one color that can't be validated statically,
 * so packs/*.test.ts asserts this pairing against `--color-on-accent` across
 * the full hue wheel rather than trusting one sample.
 */
export function Avatar({ name, hue }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const { avatarLightness, avatarChroma } = activePack;
  return (
    <div
      role="img"
      aria-label={name}
      data-hue={hue}
      className="flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-semibold text-on-accent"
      style={{ backgroundColor: `oklch(${avatarLightness}% ${avatarChroma} ${hue})` }}
    >
      {initial}
    </div>
  );
}
