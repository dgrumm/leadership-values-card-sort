import { expect, test } from '@playwright/test';

test('landing page renders the Values Cards placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Values Cards' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a session' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join a session' })).toBeVisible();
});
