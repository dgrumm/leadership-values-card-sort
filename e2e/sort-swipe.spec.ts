import { expect, test } from '@playwright/test';
import { turnOverIfFaceDown } from './deck';

// Playwright has no multi-touch drag gesture API beyond simple taps, so a
// touch-drag is simulated with the pointer primitives (mouse down/move/up) —
// framer-motion's drag handling listens to pointer events regardless of
// pointerType, so this exercises the same code path a real touch drag would.
async function dragCard(page: import('@playwright/test').Page, deltaX: number) {
  const drag = page.getByTestId('swipe-card-drag');
  const box = await drag.boundingBox();
  if (!box) throw new Error('draggable card not found');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 10 });
  await page.mouse.up();
}

test('swiping right past threshold commits a keep', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();
  await turnOverIfFaceDown(page); // 01.5: drag is inert while face-down
  const box = (await page.getByTestId('swipe-card-drag').boundingBox())!;
  await dragCard(page, box.width);
  await expect(page.getByText('11 left')).toBeVisible({ timeout: 3000 });
});

test('swiping left past threshold commits a discard', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();
  await turnOverIfFaceDown(page); // 01.5: drag is inert while face-down
  const box = (await page.getByTestId('swipe-card-drag').boundingBox())!;
  await dragCard(page, -box.width);
  await expect(page.getByText('11 left')).toBeVisible({ timeout: 3000 });
});
