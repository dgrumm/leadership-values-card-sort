import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  test(`GameCard renders a 5:7 portrait at ${viewport.name} (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/kitchen-sink');
    const card = page.locator('[data-flipped="false"]').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width / box.height).toBeCloseTo(5 / 7, 1);
    }
    // Evidence screenshot for visual review — not a pixel-diff gate (no
    // committed baseline to avoid font-rendering flakiness across machines).
    await page.screenshot({
      path: `test-results/kitchen-sink-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
