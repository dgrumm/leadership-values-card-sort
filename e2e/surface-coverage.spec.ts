import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// 00.6: blur is a pack property, not a system constant. tactile-warm's panels are glass
// (blurred, translucent); aurora has no glassmorphism at all (--panel-blur: 0px). Whichever
// pack the app was built/served with (VITE_PACK, same env var packs/index.ts reads) is the
// one this file asserts against — run it once per pack to cover both (see spec 00.6's gate).
const ACTIVE_PACK = process.env['VITE_PACK'] ?? 'tactile-warm';
const expectsBlur = ACTIVE_PACK === 'tactile-warm';

for (const viewport of VIEWPORTS) {
  test(`/create's template panel blur matches ${ACTIVE_PACK} at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/create');
    const panel = page.locator('section', { hasText: 'Customize' });
    await expect(panel).toBeVisible();
    const backdropFilter = await panel.evaluate((el) => getComputedStyle(el).backdropFilter);
    if (expectsBlur) {
      expect(backdropFilter).toContain('blur');
      expect(backdropFilter).not.toBe('none');
    } else {
      expect(backdropFilter).toBe('none');
    }
  });

  test(`the creator's lobby panel blur matches ${ACTIVE_PACK} at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/create');
    await page.getByLabel('Your name').fill('Coach');
    await page.getByRole('button', { name: 'Create game' }).click();
    const shareLink = page.getByLabel('Share link');
    await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });

    const backdropFilter = await shareLink.evaluate((el) => getComputedStyle(el).backdropFilter);
    if (expectsBlur) {
      expect(backdropFilter).toContain('blur');
      expect(backdropFilter).not.toBe('none');
    } else {
      expect(backdropFilter).toBe('none');
    }
  });
}
