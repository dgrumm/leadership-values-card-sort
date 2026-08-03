import { expect, test } from '@playwright/test';

test('kept tray expands, shows kept cards, and demotes one back to the queue', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  await page.getByRole('button', { name: /^Keep / }).click();
  await expect(page.getByRole('button', { name: 'Kept cards: 1 / 6 kept' })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: /^Keep / }).click();
  await expect(page.getByRole('button', { name: 'Kept cards: 2 / 6 kept' })).toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: 'Kept cards: 2 / 6 kept' }).click();
  const demoteButtons = page.getByRole('button', { name: 'Demote' });
  await expect(demoteButtons).toHaveCount(2);

  await demoteButtons.first().click();
  await expect(page.getByRole('button', { name: 'Kept cards: 1 / 6 kept' })).toBeVisible();
  await expect(page.getByText('11 left')).toBeVisible(); // demoted card returned to the queue
});
