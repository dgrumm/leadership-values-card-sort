import { expect, test } from '@playwright/test';

test('the active card has no focus ring on initial load (no mount autofocus)', async ({
  page,
}) => {
  await page.goto('/sort');
  const group = page.getByRole('group', { name: /card$/ });
  await expect(group).toBeVisible();
  const isFocused = await group.evaluate((el) => el === document.activeElement);
  expect(isFocused).toBe(false);
  const boxShadow = await group.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(boxShadow).toBe('none');
});

test('Tab focuses the active card and shows the shadow-focus glow', async ({ page }) => {
  await page.goto('/sort');
  await page.keyboard.press('Tab');
  const group = page.getByRole('group', { name: /card$/ });
  await expect(group).toBeFocused();
  const boxShadow = await group.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(boxShadow).not.toBe('none');
});
