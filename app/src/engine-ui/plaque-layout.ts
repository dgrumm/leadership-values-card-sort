/**
 * The shared plaque layout: dimensions, spacing, and type scale as plain data (px
 * numbers, no CSS). `Plaque.tsx` (screen) and 04.1's satori export both read this one
 * definition so the exported artifact matches what participants saw on the wall —
 * satori has no CSS custom-property support, so these can't live in `@theme` tokens.
 */
export const plaqueLayout = {
  width: 340,
  padding: 20,
  gap: 16,
  headerGap: 12,
  cardWidth: 88,
  cardHeight: 120,
  cardGap: 10,
  nameSize: 20,
  titleSize: 13,
  badgeSize: 22,
} as const;

export type PlaqueLayout = typeof plaqueLayout;
