import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PACK_CSS_VARS, PACK_NAMES, PACKS } from './index';

const PACKS_DIR = dirname(fileURLToPath(import.meta.url));

/** Extracts a custom property's raw value from a stylesheet, across line-wraps. */
function cssVarValue(css: string, varName: string): string | undefined {
  const match = new RegExp(`${varName}:\\s*([^;]+);`).exec(css);
  return match?.[1];
}

/** Collapses all whitespace so line-wrapped CSS compares equal to a one-line TS literal. */
function squash(value: string): string {
  return value.replace(/\s+/g, '');
}

describe('every pack supplies every var, and its .ts and .css agree', () => {
  for (const name of PACK_NAMES) {
    const pack = PACKS[name];
    const css = readFileSync(join(PACKS_DIR, `${name}.css`), 'utf8');

    for (const [field, cssVar] of Object.entries(PACK_CSS_VARS)) {
      it(`${name}: ${cssVar} matches ${field} in ${name}.ts`, () => {
        const tsValue = pack[field as keyof typeof pack] as string;
        expect(tsValue).toBeTruthy();
        const cssValue = cssVarValue(css, cssVar);
        expect(cssValue, `${cssVar} not found in ${name}.css`).toBeDefined();
        expect(squash(cssValue ?? '')).toBe(squash(tsValue));
      });
    }

    it(`${name}: fieldStops is non-empty`, () => {
      expect(pack.fieldStops.length).toBeGreaterThan(0);
    });
  }
});
