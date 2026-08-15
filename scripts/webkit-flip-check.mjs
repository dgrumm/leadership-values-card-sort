#!/usr/bin/env node
/**
 * WebKit compositing check for the card flip (01.5).
 *
 * `.card-face` combines three things WebKit has historically handled badly
 * together: `backdrop-filter` (from `.glass-panel`), `backface-visibility:
 * hidden`, and a `transform-style: preserve-3d` ancestor. WebKit can flatten 3D
 * descendants of a filtered element, which would blank a face or kill the turn
 * outright — and Chromium cannot tell you whether that happens.
 *
 * Deliberately a script, not an `e2e/*.spec.ts`: test discovery is
 * include-by-default (CLAUDE.md), so a spec here would join every `pnpm gate`
 * run, and `playwright.config.ts` ships no WebKit project for it to run under.
 * Adding continuous WebKit coverage is 04.2's call, not this spec's.
 *
 * Usage — needs the app dev server up:
 *   pnpm dev:app &
 *   node scripts/webkit-flip-check.mjs [baseURL]
 *
 * Exits non-zero on the first failed assertion. Writes screenshots to
 * `.webkit-check/` for eyeballing, since "renders correctly" is not fully
 * expressible as an assertion.
 */

import { mkdirSync } from 'node:fs';
import { devices, webkit } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://localhost:5173';
const OUT = '.webkit-check';
const failures = [];

function check(label, condition, detail) {
  const status = condition ? 'ok  ' : 'FAIL';
  console.log(`  [${status}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(label);
}

mkdirSync(OUT, { recursive: true });
const browser = await webkit.launch();

for (const [label, contextOptions] of [
  ['desktop-safari', {}],
  ['iphone', devices['iPhone 14']],
]) {
  console.log(`\n${label}`);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(`${baseURL}/sort`);
  await page.waitForSelector('button:has-text("Turn over")', { timeout: 15_000 });

  const faceDown = await page.evaluate(() => {
    const deck = document.querySelector('[data-testid="deck-card"] [data-flipped]');
    const back = document.querySelector('[data-testid="card-back"]');
    return {
      transformStyle: deck ? getComputedStyle(deck).transformStyle : null,
      rotated: deck ? getComputedStyle(deck).transform.startsWith('matrix3d') : false,
      backfaceVisibility: back ? getComputedStyle(back).backfaceVisibility : null,
      backdropFilter: back ? getComputedStyle(back).backdropFilter : null,
      backPainted: back ? back.getBoundingClientRect().width > 0 : false,
      frontMounted: !!document.querySelector('[data-testid="card-front"]'),
    };
  });

  // preserve-3d surviving next to backdrop-filter is the whole question.
  check('preserve-3d not flattened', faceDown.transformStyle === 'preserve-3d', faceDown.transformStyle);
  check('backface-visibility honored', faceDown.backfaceVisibility === 'hidden', faceDown.backfaceVisibility);
  check('backdrop-filter still applied', /blur/.test(faceDown.backdropFilter ?? ''), faceDown.backdropFilter);
  check('back face has a painted box', faceDown.backPainted);
  check('no front face while face-down', faceDown.frontMounted === false);
  await page.screenshot({ path: `${OUT}/${label}-face-down.png` });

  await page.click('button:has-text("Turn over")');
  await page.waitForSelector('[data-testid="card-front"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  const faceUp = await page.evaluate(() => {
    const front = document.querySelector('[data-testid="card-front"]');
    const box = front?.getBoundingClientRect();
    return { w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0) };
  });
  check('front face painted after turning over', faceUp.w > 0 && faceUp.h > 0, `${faceUp.w}x${faceUp.h}`);
  await page.screenshot({ path: `${OUT}/${label}-face-up.png` });

  // Sample the deck card's rotation across a commit: a flattened 3D context or a
  // dropped animation shows up as zero intermediate angles.
  await page.evaluate(() => {
    window.__samples = [];
    window.__sampling = true;
    const tick = () => {
      const el = document.querySelector('[data-testid="deck-card"] [data-flipped]');
      if (el) window.__samples.push(getComputedStyle(el).transform);
      if (window.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.click('button[aria-label^="Keep"]');
  await page.waitForTimeout(900);
  const midTurn = await page.evaluate(() => {
    window.__sampling = false;
    return window.__samples
      .filter((s) => s.startsWith('matrix3d'))
      .map((s) => Number(s.slice('matrix3d('.length).split(',')[0]))
      .filter((cos) => cos > -0.9 && cos < 0.9).length;
  });
  check('deck card rotates through intermediate angles', midTurn > 2, `${midTurn} mid-turn frames`);
  await page.screenshot({ path: `${OUT}/${label}-after-commit.png` });

  await context.close();
}

await browser.close();

console.log(`\nScreenshots: ${OUT}/`);
if (failures.length > 0) {
  console.error(`\nwebkit-flip-check: ${failures.length} failure(s): ${failures.join(', ')}`);
  console.error('Fallback if compositing is at fault: drop .glass-panel from .card-face');
  console.error('consumers so no filtered element sits inside the preserve-3d context.');
  process.exit(1);
}
console.log('\nwebkit-flip-check: OK');
