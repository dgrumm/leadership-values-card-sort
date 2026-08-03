import { expect, test } from '@playwright/test';

// Every value/description string in the demo deck (app/src/routes/Sort.tsx) —
// none of these may ever appear in a network frame before reveal (02.2).
const CARD_STRINGS = [
  'Courage',
  'Acting despite fear',
  'Curiosity',
  'Seeking to understand',
  'Integrity',
  'Consistency of values and action',
  'Trust',
  'Confidence in others’ intentions',
  'Growth',
  'Committing to improve',
  'Empathy',
  'Understanding others’ experience',
  'Discipline',
  'Doing what matters most',
  'Humility',
  'Openness to being wrong',
  'Resilience',
  'Recovering from setbacks',
  'Fairness',
  'Treating others equitably',
  'Creativity',
  'Generating novel ideas',
  'Gratitude',
  'Appreciating what is given',
];

test('sorting a full round emits no card data over the network (invariant 1)', async ({ page }) => {
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    ws.on('framesent', (frame) => frames.push(String(frame.payload)));
    ws.on('framereceived', (frame) => frames.push(String(frame.payload)));
  });

  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  for (let i = 0; i < 12; i++) {
    const remainingBefore = 12 - i;
    await page.getByRole('button', { name: /^Keep / }).click();
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    } else {
      await expect(page.getByText('Round complete')).toBeVisible({ timeout: 3000 });
    }
  }

  // The sort loop (01.3) opens no app socket at all (that's 01.2/02.1) — the
  // only frame here is Vite's dev-server HMR client, unrelated to the app.
  // Assert no frame, from any socket, ever carries card data.
  expect(frames.length).toBeGreaterThan(0); // sanity: the websocket hook is wired up
  for (const frame of frames) {
    for (const text of CARD_STRINGS) {
      expect(frame).not.toContain(text);
    }
  }
});
