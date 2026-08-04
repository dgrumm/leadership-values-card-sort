import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');

function tokenHex(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(CSS);
  if (!match?.[1]) throw new Error(`token --color-${name} not found in tokens.css`);
  return match[1];
}

function hexToRgb(hex: string): [number, number, number] {
  // tokens.css uses 6-digit hex exclusively; tokenHex's regex enforces it.
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Reads a `rgb(r g b / a%)` color token (glass surfaces use this form). */
function tokenRgba(name: string): [number, number, number, number] {
  const match = new RegExp(
    `--color-${name}:\\s*rgb\\((\\d+)\\s+(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)%\\)`,
  ).exec(CSS);
  if (!match) throw new Error(`token --color-${name} not found in tokens.css`);
  const [, r, g, b, a] = match.map(Number);
  return [r as number, g as number, b as number, (a as number) / 100];
}

/** Flattens a translucent color over an opaque background (both 0-255 channels). */
function compositeOver(
  [r, g, b, a]: [number, number, number, number],
  bg: [number, number, number],
): [number, number, number] {
  const fg = [r, g, b];
  return [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a)) as [number, number, number];
}

const IRIS_STOPS = ['iris-peach', 'iris-pink', 'iris-lilac', 'iris-sky', 'iris-mint'];

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two 0-255 RGB colors, order-independent. */
function contrastRatioRgb(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const [lumA, lumB] = [relativeLuminance(rgbA), relativeLuminance(rgbB)];
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG contrast ratio between two hex colors, order-independent. */
function contrastRatio(hexA: string, hexB: string): number {
  return contrastRatioRgb(hexToRgb(hexA), hexToRgb(hexB));
}

// AA normal-text threshold is 4.5:1; large-text (≥18.66px bold / 24px regular) is 3:1.
const AA_NORMAL = 4.5;

describe('design token color pairings (WCAG AA)', () => {
  it('ink on surface passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('ink'), tokenHex('surface'))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('ink-muted on surface passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('ink-muted'), tokenHex('surface'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it('on-accent on accent passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('on-accent'), tokenHex('accent'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it('on-accent on accent-hover passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('on-accent'), tokenHex('accent-hover'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  // Pairings used by Button's danger variant and Toast's danger/success variants.
  it('on-accent on danger passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('on-accent'), tokenHex('danger'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it('on-accent on success passes AA for normal text', () => {
    expect(contrastRatio(tokenHex('on-accent'), tokenHex('success'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });
});

describe('liquid glass token color pairings (WCAG AA)', () => {
  for (const stop of IRIS_STOPS) {
    it(`ink on --color-${stop} passes AA for normal text`, () => {
      expect(contrastRatio(tokenHex('ink'), tokenHex(stop))).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`ink-muted on --color-${stop} passes AA for normal text`, () => {
      expect(contrastRatio(tokenHex('ink-muted'), tokenHex(stop))).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  }

  // Worst-case text-on-panel: glass-strong composited over the lightest (highest-luminance)
  // iris stop — the panel's translucency lets the brightest possible field bleed through.
  it('ink and ink-muted on glass-strong over the lightest iris stop pass AA for normal text', () => {
    const lightestStop = IRIS_STOPS.map((stop) => hexToRgb(tokenHex(stop))).reduce((a, b) =>
      relativeLuminance(a) > relativeLuminance(b) ? a : b,
    );
    const composited = compositeOver(tokenRgba('glass-strong'), lightestStop);
    expect(contrastRatioRgb(hexToRgb(tokenHex('ink')), composited)).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatioRgb(hexToRgb(tokenHex('ink-muted')), composited)).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });
});
