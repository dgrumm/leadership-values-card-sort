import { expect, test } from '@playwright/test';
import { sortTopCard } from './deck';

// Every value/description string in the demo deck (app/src/routes/Sort.tsx) —
// none of these may ever appear in a network frame before reveal (02.2).
const CARD_STRINGS = [
  'Caffeine',
  'The fundamental belief that productivity is directly proportional to coffee consumption',
  'Snacks',
  'Commitment to maintaining strategic reserves of treats for optimal team morale',
  'Muting',
  'The discipline to silence oneself before dogs, children, or doorbells interrupt meetings',
  'Restraint',
  'The wisdom to resist reply-all when someone microwaves fish in the office',
  'Efficiency',
  'The courage to end meetings that have veered into discussing weekend plans',
  'Flexibility',
  'The art of interpreting deadlines as gentle suggestions rather than fixed points',
  'Lunch',
  'The sacred practice of stepping away from one’s desk for actual nourishment',
  'Emojis',
  'The ability to convey professionalism while using the perfect amount of 👍 and 😊',
  'Parking',
  'The mystical force that guides one to spaces near the entrance, always',
  'Friday',
  'The superhuman strength to maintain focus despite the weekend’s gravitational pull',
  'Spreadsheets',
  'Finding enlightenment through pivot tables and conditional formatting',
  'Cake',
  'The moral duty to ensure equitable distribution of celebration desserts',
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
    await sortTopCard(page, 'keep');
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    } else {
      // Keeping all 12 is over round 1's keep-count of 8 — lands in TrimGrid (01.4).
      await expect(page.getByRole('heading', { name: 'Trim to 8' })).toBeVisible({ timeout: 3000 });
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
