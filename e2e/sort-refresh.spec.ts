import { expect, test } from '@playwright/test';
import { sortTopCard } from './deck';

interface PersistedSortState {
  kept: string[];
  discarded: string[];
  queue: string[];
}

async function readSortState(page: import('@playwright/test').Page): Promise<PersistedSortState> {
  return page.evaluate(() => {
    const participantId = localStorage.getItem('vc:demo:participantId');
    const raw = localStorage.getItem(`vc:DEMO01:${participantId}:sort`);
    if (!raw) throw new Error('no persisted sort state found');
    return (JSON.parse(raw) as { state: PersistedSortState }).state;
  });
}

test('refresh mid-round preserves exact sort progress (invariant 4)', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  for (let i = 0; i < 7; i++) {
    const remainingBefore = 12 - i;
    await sortTopCard(page, i % 2 === 0 ? 'keep' : 'discard');
    await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
  }

  const before = await readSortState(page);
  expect(before.kept).toHaveLength(4);
  expect(before.discarded).toHaveLength(3);

  await page.reload();
  await expect(page.getByText('5 left')).toBeVisible();

  const after = await readSortState(page);
  expect(after.kept).toEqual(before.kept);
  expect(after.discarded).toEqual(before.discarded);
  expect(after.queue[0]).toBe(before.queue[0]); // same next card
});
