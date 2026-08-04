import { expect, test } from '@playwright/test';

test('landing page renders the Values Cards placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Values Cards' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a session' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join a session' })).toBeVisible();
});

// Regression: 00.4 put the iridescent field on `body`, but every route's full-screen
// `<main>` kept an opaque `bg-surface`, painting the field over on every real screen —
// so the app looked like the old warm theme everywhere except /kitchen-sink. The field
// existing on body isn't enough; a real route must not cover it.
test('the iridescent field is actually visible on the landing route (not covered by main)', async ({ page }) => {
  await page.goto('/');
  const field = await page.evaluate(() => {
    const main = document.querySelector('main');
    const toRgba = (c: string) => c.replace(/\s+/g, '');
    return {
      bodyGradient: getComputedStyle(document.body).backgroundImage,
      mainBg: main ? toRgba(getComputedStyle(main).backgroundColor) : 'no-main',
    };
  });
  // The body carries the iridescent gradient...
  expect(field.bodyGradient).toContain('gradient');
  // ...and the top-level main must be transparent, so the field shows through rather than
  // being hidden behind an opaque surface fill.
  expect(['rgba(0,0,0,0)', 'transparent']).toContain(field.mainBg);
});
