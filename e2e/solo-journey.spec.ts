import { expect, type Page, test } from '@playwright/test';

// dev-12 deck, rounds 12 -> keep 8 -> keep 3 (ranked) — app/src/routes/Sort.tsx's demo config.

/** dnd-kit measures every droppable's rect via ResizeObserver right as a
 * drag starts — that lands a frame or two after pointerdown, so the very
 * next move can otherwise compute against stale rects. A wall-clock wait is
 * flaky under load; waiting for real frames to elapse isn't. */
async function waitForLayoutMeasurement(page: Page) {
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
}

test('solo journey (pointer): sort -> trim -> next round -> rank -> result', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  // Round 1 (keep 8 of 12): deliberately over-keep 10, discard 2, to force TrimGrid.
  for (let i = 0; i < 12; i++) {
    const remainingBefore = 12 - i;
    await page.getByRole('button', { name: i < 10 ? /^Keep / : /^Discard / }).click();
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
  await expect(page.getByRole('heading', { name: 'Trim to 8' })).toBeVisible({ timeout: 3000 });

  // Cut 2 to clear the keep-count.
  const trimItems = page.getByRole('listitem');
  await trimItems.nth(0).click();
  await trimItems.nth(1).click();
  const confirmTrim = page.getByRole('button', { name: 'Confirm' });
  await expect(confirmTrim).toBeEnabled();
  await confirmTrim.click();

  await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Round 2 (final, ranked, keep 3 of 8).
  await expect(page.getByText('8 left')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const remainingBefore = 8 - i;
    await page.getByRole('button', { name: i < 3 ? /^Keep / : /^Discard / }).click();
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
  await expect(page.getByRole('heading', { name: 'Rank your final cards' })).toBeVisible({ timeout: 3000 });

  // Drag the first handle down past the second item.
  const handle = page.getByRole('listitem').first().getByRole('button');
  const box = await handle.boundingBox();
  if (!box) throw new Error('rank handle not found');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await waitForLayoutMeasurement(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40, { steps: 10 });
  await page.mouse.up();
  // dnd-kit stops propagation on the synthetic click that trails a pointer
  // drag for 50ms after pointerup (browsers fire that click regardless of
  // drag) — past that window before clicking Confirm order for real.
  await page.waitForTimeout(60);

  await page.getByRole('button', { name: 'Confirm order' }).click();

  await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Reveal' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download' })).toBeDisabled();
});

test('solo journey (keyboard-only): sort -> trim -> next round -> rank -> result', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  // Round 1: over-keep 10 of 12 via keyboard alone.
  for (let i = 0; i < 12; i++) {
    const remainingBefore = 12 - i;
    // 00.4 removed the mount autofocus, so each new card (a remount) needs a Tab first.
    await page.keyboard.press('Tab');
    await page.keyboard.press(i < 10 ? 'ArrowRight' : 'ArrowLeft');
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
  await expect(page.getByRole('heading', { name: 'Trim to 8' })).toBeVisible({ timeout: 3000 });

  // Roving-tabindex grid: Tab onto it, Enter cuts, ArrowRight moves the tab stop.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible({ timeout: 3000 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  // Round 2 (final, ranked, keep 3 of 8) via keyboard alone.
  await expect(page.getByText('8 left')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const remainingBefore = 8 - i;
    await page.keyboard.press('Tab');
    await page.keyboard.press(i < 3 ? 'ArrowRight' : 'ArrowLeft');
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
  await expect(page.getByRole('heading', { name: 'Rank your final cards' })).toBeVisible({ timeout: 3000 });

  // Tab past the 3 sortable handles to reach Confirm order — the keyboard
  // sensor's reordering (space to lift, arrows to move, space to drop) is
  // unit-tested in rank-board.test.tsx; this journey only needs to prove
  // the whole flow is reachable without a pointer.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Confirm order' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('listitem')).toHaveCount(3);
});
