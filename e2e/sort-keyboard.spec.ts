import { expect, test } from '@playwright/test';

test('completes a 12-card round using only the keyboard', async ({ page }) => {
  await page.goto('/sort');

  for (let i = 0; i < 12; i++) {
    const remainingBefore = 12 - i;
    await expect(page.getByText(`${remainingBefore} left`)).toBeVisible();
    await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    } else {
      await expect(page.getByText('Round complete')).toBeVisible({ timeout: 3000 });
    }
  }
});
