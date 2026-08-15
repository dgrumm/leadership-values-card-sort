import { aurora } from './aurora';
import { tactileWarm } from './tactile-warm';
import type { Pack } from './types';

export type { Pack } from './types';
export { PACK_CSS_VARS } from './types';

export const PACKS = {
  'tactile-warm': tactileWarm,
  aurora,
} as const satisfies Record<string, Pack>;

export type PackName = keyof typeof PACKS;
export const PACK_NAMES = Object.keys(PACKS) as PackName[];

const DEFAULT_PACK: PackName = 'tactile-warm';

function isPackName(value: string | undefined): value is PackName {
  return !!value && value in PACKS;
}

/**
 * The active pack is build-time, not per-session (00.6) — a typed constant, not
 * `ThemeConfigSchema`. `VITE_PACK` exists only so `pnpm gate`/CI can run the full
 * suite once per pack without hand-editing this file; it is not a runtime/session
 * switch and defaults to `tactile-warm` exactly like a hardcoded constant would.
 * `vite.config.ts` reads the same env var to pick which pack's CSS is bundled.
 */
export const ACTIVE_PACK: PackName = isPackName(import.meta.env['VITE_PACK'])
  ? import.meta.env['VITE_PACK']
  : DEFAULT_PACK;

export const activePack: Pack = PACKS[ACTIVE_PACK];
