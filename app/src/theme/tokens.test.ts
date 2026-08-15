import { describe, expect, it } from 'vitest';
import { PACK_NAMES, PACKS, type Pack } from './packs';

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Reads a color that's either 6-digit hex (alpha 1) or `rgb(r g b / a%)` (theme/'s panel/scrim syntax). */
function toRgba(value: string): [number, number, number, number] {
  if (value.startsWith('#')) return [...hexToRgb(value), 1];
  const match = /rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*(\d+)%\)/.exec(value);
  if (!match) throw new Error(`unrecognized color syntax: ${value}`);
  const [, r, g, b, a] = match.map(Number);
  return [r as number, g as number, b as number, (a as number) / 100];
}

function toRgb(value: string): [number, number, number] {
  return toRgba(value).slice(0, 3) as [number, number, number];
}

function compositeOver(
  [r, g, b, a]: [number, number, number, number],
  bg: [number, number, number],
): [number, number, number] {
  const fg = [r, g, b];
  return [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a)) as [number, number, number];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatioRgb(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const [lumA, lumB] = [relativeLuminance(rgbA), relativeLuminance(rgbB)];
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastRatio(a: string, b: string): number {
  return contrastRatioRgb(toRgb(a), toRgb(b));
}

// AA normal-text threshold is 4.5:1; large-text (>= 18.66px bold / 24px regular) is 3:1.
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/*
 * Every AA pairing, asserted for EVERY pack (00.6, product invariant 6). A dark canvas
 * (aurora) invalidates every pairing tuned for a light one, so this can't assume
 * tactile-warm's values — it reads each pack's own Pack object, the single TS source
 * of truth packs/<name>.css is also generated from (packs.test.ts guards the sync).
 */
for (const name of PACK_NAMES) {
  const pack: Pack = PACKS[name];

  describe(`design token color pairings (WCAG AA) — ${name}`, () => {
    it('ink on surface passes AA for normal text', () => {
      expect(contrastRatio(pack.colorInk, pack.colorSurface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('ink-muted on surface passes AA for normal text', () => {
      expect(contrastRatio(pack.colorInkMuted, pack.colorSurface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('on-accent on accent passes AA for normal text', () => {
      expect(contrastRatio(pack.colorOnAccent, pack.colorAccent)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('on-accent on accent-hover passes AA for normal text', () => {
      expect(contrastRatio(pack.colorOnAccent, pack.colorAccentHover)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    // Pairings used by Button's danger variant and Toast's danger/success variants.
    it('on-accent on danger passes AA for normal text', () => {
      expect(contrastRatio(pack.colorOnAccent, pack.colorDanger)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it('on-accent on success passes AA for normal text', () => {
      expect(contrastRatio(pack.colorOnAccent, pack.colorSuccess)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it("focus ring's outer ring passes AA-large against the pack's surface", () => {
      const composited = compositeOver(toRgba(pack.shadowFocusRing), toRgb(pack.colorSurface));
      expect(contrastRatioRgb(composited, toRgb(pack.colorSurface))).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    });
  });

  describe(`field token color pairings (WCAG AA) — ${name}`, () => {
    for (const stop of pack.fieldStops) {
      it(`ink on field stop ${stop} passes AA for normal text`, () => {
        expect(contrastRatio(pack.colorInk, stop)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it(`ink-muted on field stop ${stop} passes AA for normal text`, () => {
        expect(contrastRatio(pack.colorInkMuted, stop)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }

    /*
     * Text on a translucent panel, composited over EVERY field stop — not the
     * lightest/most-favorable one. A pack whose panel is fully opaque (alpha 1) has
     * this degrade to a no-op (the field never shows through), which is exactly
     * right: opacity is what makes the field irrelevant, not an assumption baked
     * into the test.
     */
    for (const stop of pack.fieldStops) {
      it(`ink and ink-muted on panel-strong over field stop ${stop} pass AA for normal text`, () => {
        const composited = compositeOver(toRgba(pack.panelBgStrong), toRgb(stop));
        expect(contrastRatioRgb(toRgb(pack.colorInk), composited)).toBeGreaterThanOrEqual(
          AA_NORMAL,
        );
        expect(contrastRatioRgb(toRgb(pack.colorInkMuted), composited)).toBeGreaterThanOrEqual(
          AA_NORMAL,
        );
      });
    }
  });
}
