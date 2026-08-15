import { expect, test } from '@playwright/test';
import { turnOverIfFaceDownWithKeyboard } from './deck';

test('completes a 12-card round using only the keyboard', async ({ page }) => {
  await page.goto('/sort');

  for (let i = 0; i < 12; i++) {
    const remainingBefore = 12 - i;
    await expect(page.getByText(`${remainingBefore} left`)).toBeVisible();
    // 00.4 removed the mount autofocus (no ring on initial load), so each new card
    // (a remount — CardStack keys SwipeCard by card value) must be Tab'd to first.
    await page.keyboard.press('Tab');
    // 01.5: round 1 opens face-down — Enter turns the card over, then the arrows commit.
    await turnOverIfFaceDownWithKeyboard(page);
    await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    } else {
      // 6 keeps / 6 discards, at/under round 1's keep-count of 8 — straight
      // to the round-complete interstitial (01.4), no trim needed.
      await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible({ timeout: 3000 });
    }
  }
});
