import { describe, expect, it } from 'vitest';
import { PACK_NAMES, PACKS } from './index';

/**
 * Avatar.tsx computes `oklch(L% C hue)` at runtime per participant — the one color not
 * read from a token, so it can't be checked by parsing a stylesheet. This reimplements
 * the standard OKLab/OKLCH -> linear-sRGB conversion (Björn Ottosson's published
 * matrices) purely to validate AA here; nothing in the app needs this math, since the
 * browser's own `oklch()` does the same conversion when it paints the swatch.
 */
function oklchToSrgb(l: number, c: number, hueDeg: number): [number, number, number] {
  const h = (hueDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const gammaEncode = (channel: number) => {
    const clamped = Math.max(0, Math.min(1, channel));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };
  return [
    gammaEncode(rLinear) * 255,
    gammaEncode(gLinear) * 255,
    gammaEncode(bLinear) * 255,
  ];
}

function hexToRgb(hex: string): [number, number, number] {
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

function contrastRatio(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const [lumA, lumB] = [relativeLuminance(rgbA), relativeLuminance(rgbB)];
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
const HUE_STEP = 5; // 0-360 stepped, not one sample

describe('avatar swatch vs --color-on-accent, across the full hue wheel', () => {
  for (const name of PACK_NAMES) {
    const pack = PACKS[name];
    const onAccentRgb = hexToRgb(pack.colorOnAccent);

    it(`${name}: every hue 0-360 (step ${HUE_STEP}) passes AA`, () => {
      const failures: string[] = [];
      for (let hue = 0; hue < 360; hue += HUE_STEP) {
        const swatchRgb = oklchToSrgb(pack.avatarLightness / 100, pack.avatarChroma, hue);
        const ratio = contrastRatio(swatchRgb, onAccentRgb);
        if (ratio < AA_NORMAL) failures.push(`hue ${hue}: ${ratio.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });
  }
});
