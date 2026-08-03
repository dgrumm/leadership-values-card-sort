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

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two colors, order-independent. */
function contrastRatio(hexA: string, hexB: string): number {
  const [lumA, lumB] = [relativeLuminance(hexToRgb(hexA)), relativeLuminance(hexToRgb(hexB))];
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
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
