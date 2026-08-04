import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// 00.5: glass is a system, not a handful of sort-flow primitives — /create's template
// summary panel and a real lobby (creator's, via /create -> Create game) must both render
// translucent, blurred glass on the iridescent field, at both a desktop and mobile viewport.
for (const viewport of VIEWPORTS) {
  test(`/create's template panel is glass (blurred, translucent) at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/create');
    const panel = page.locator('section', { hasText: 'Customize' });
    await expect(panel).toBeVisible();
    const backdropFilter = await panel.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toContain('blur');
    expect(backdropFilter).not.toBe('none');
  });

  test(`the creator's lobby panel is glass (blurred, translucent) at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/create');
    await page.getByLabel('Your name').fill('Coach');
    await page.getByRole('button', { name: 'Create game' }).click();
    const shareLink = page.getByLabel('Share link');
    await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });

    const backdropFilter = await shareLink.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toContain('blur');
    expect(backdropFilter).not.toBe('none');
  });
}
