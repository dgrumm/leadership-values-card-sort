import { expect, type Locator, type Page, test } from '@playwright/test';
import { turnOverIfFaceDown } from './deck';

async function cardNameOf(item: Locator): Promise<string> {
  const label = await item.locator('p').first().textContent();
  return (label ?? '').replace(/^\d+\.\s*/, '');
}

async function orderOf(items: Locator): Promise<string[]> {
  const count = await items.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(await cardNameOf(items.nth(i)));
  }
  return names;
}

/**
 * Drags the first item down past the second with the pointer. The keyboard
 * sensor (space to lift, arrows to move, space to drop) is exercised by
 * `rank-board.test.tsx` and the keyboard-only solo journey instead — under
 * this suite's real-browser layout, ArrowDown's rect-based jump is prone to
 * losing a race with dnd-kit's ResizeObserver measurement (or scrolling the
 * page instead of the item, per dnd-kit's own auto-scroll handling), which a
 * pointer drag with real, on-screen coordinates doesn't hit.
 */
async function reorderFirstItemDown(page: Page, items: Locator): Promise<string[]> {
  const before = await orderOf(items);
  const handle = items.first().getByRole('button');
  const box = await handle.boundingBox();
  if (!box) throw new Error('rank handle not found');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // dnd-kit measures every droppable's rect via ResizeObserver right as the
  // drag starts — give that a moment or the move can compute against stale
  // rects.
  await page.waitForTimeout(150);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 2, { steps: 10 });
  await page.mouse.up();
  const after = await orderOf(items);
  if (after.join('|') === before.join('|')) {
    throw new Error('pointer reorder never changed the rank order');
  }
  return after;
}

/** Clicks Keep/Discard `count` times, waiting for each card's exit animation
 * to settle (the "N left" counter to decrement) before the next click. */
async function resolveQueue(page: Page, count: number, keep: (index: number) => boolean) {
  for (let i = 0; i < count; i++) {
    const remainingBefore = count - i;
    // 01.5: each round opens face-down, so turn the top card over first.
    await turnOverIfFaceDown(page);
    await page.getByRole('button', { name: keep(i) ? /^Keep / : /^Discard / }).click();
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
}

test('refresh during TrimGrid preserves the exact cut selection (invariant 4)', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  // Keep every card — 12 kept is over round 1's keep-count of 8.
  await resolveQueue(page, 12, () => true);
  await expect(page.getByRole('heading', { name: 'Trim to 8' })).toBeVisible({ timeout: 3000 });

  const items = page.getByRole('listitem');
  const firstName = await items.first().getAttribute('aria-label');
  await items.first().click();
  await expect(page.getByText('Cut 3 more')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Trim to 8' })).toBeVisible();
  await expect(page.getByText('Cut 3 more')).toBeVisible();
  await expect(page.getByRole('listitem', { name: `${firstName}, cut` })).toBeVisible();
});

test('refresh during RankBoard preserves the exact rank order (invariant 4)', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  // Round 1: keep exactly 8, discard 4 — at the keep-count, straight to
  // round-complete with no trim needed.
  await resolveQueue(page, 12, (i) => i < 8);
  await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('8 left')).toBeVisible();
  // Round 2 (final, ranked): keep exactly 3, discard 5.
  await resolveQueue(page, 8, (i) => i < 3);
  await expect(page.getByRole('heading', { name: 'Rank your final cards' })).toBeVisible({ timeout: 3000 });

  const items = page.getByRole('listitem');
  const reordered = await reorderFirstItemDown(page, items);

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Rank your final cards' })).toBeVisible();
  await expect.poll(() => orderOf(page.getByRole('listitem'))).toEqual(reordered);

  // Ranking round-trips onto the result screen too, including through a
  // second refresh once it's the terminal state (the result screen's cards
  // are the Plaque component's (02.3) mini cards, not RankBoard's numbered
  // paragraphs — read the plaque card's title).
  //
  // dnd-kit stops propagation on the synthetic click that trails a pointer
  // drag for 50ms after pointerup (browsers fire that click regardless of
  // drag) — past that window before clicking Confirm order for real.
  await page.waitForTimeout(60);
  await page.getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible({ timeout: 3000 });
  const resultOrder = async () => {
    const cards = page.getByRole('listitem');
    const count = await cards.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push((await cards.nth(i).locator('p').first().textContent()) ?? '');
    }
    return names;
  };
  await expect.poll(resultOrder).toEqual(reordered);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo' })).toBeVisible();
  await expect.poll(resultOrder).toEqual(reordered);
});
