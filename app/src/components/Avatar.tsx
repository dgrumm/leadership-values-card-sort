export interface AvatarProps {
  name: string;
  /** Hue angle (0-360) driving the swatch color — stable per participant. */
  hue: number;
}

/**
 * Renders a participant's initial on an OKLCH swatch derived from their
 * assigned hue. The hue is per-participant data, not a design token, so the
 * color here is computed rather than pulled from `@theme`.
 */
export function Avatar({ name, hue }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      role="img"
      aria-label={name}
      className="flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-semibold text-on-accent"
      style={{ backgroundColor: `oklch(55% 0.12 ${hue})` }}
    >
      {initial}
    </div>
  );
}
