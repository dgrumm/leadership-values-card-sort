import { expect, test, type Page } from '@playwright/test';

/**
 * A deliberately tiny deck (4 cards, 1 round, keep 2, non-facilitated) so a full round
 * — join through result — is a handful of keypresses, not forty. `facilitated: false`
 * exercises the 02.1 lobby rule: any participant may start.
 */
const CUSTOM_CONFIG = {
  title: 'Presence E2E',
  deck: {
    name: 'Mini',
    cards: [
      { value: 'Alpha', description: 'The first mini-deck value, never sent unrevealed' },
      { value: 'Beta', description: 'The second mini-deck value, never sent unrevealed' },
      { value: 'Gamma', description: 'The third mini-deck value, never sent unrevealed' },
      { value: 'Delta', description: 'The fourth mini-deck value, never sent unrevealed' },
    ],
  },
  rounds: [{ name: 'Round 1', keep: 2, rank: false }],
  theme: { variant: 'default' },
  facilitated: false,
};

const CARD_NEEDLES = CUSTOM_CONFIG.deck.cards.flatMap((card) => [card.value, card.description]);

/** The deck listing itself is public config, not a participant's unrevealed choice —
 *  strip it before scanning a frame for card leakage (invariant 1 is about choices, not
 *  the shared config every client legitimately receives). */
function stripConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripConfig);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'config')
        .map(([key, v]) => [key, stripConfig(v)]),
    );
  }
  return value;
}

function assertNoCardLeak(frames: string[], label: string) {
  for (const raw of frames) {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      continue; // not JSON — can't be a card leak
    }
    const scrubbed = JSON.stringify(stripConfig(payload));
    for (const needle of CARD_NEEDLES) {
      expect(scrubbed, `${label} frame leaked "${needle}": ${raw}`).not.toContain(needle);
    }
  }
}

function collectFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => frames.push(typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8')));
    ws.on('framesent', (f) => frames.push(typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8')));
  });
  return frames;
}

async function joinAs(page: Page, code: string, name: string, creatorToken?: string) {
  await page.goto(`/join/${code}`);
  if (creatorToken) {
    await page.evaluate(
      ({ code: c, token }) => sessionStorage.setItem(`vc:${c}:creatorToken`, token),
      { code, token: creatorToken },
    );
  }
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });
}

test('presence: roster membership, live progress, done, matching avatar hue, no card leakage', async ({ browser, request }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const framesA = collectFrames(pageA);
  const framesB = collectFrames(pageB);

  const created = await (
    await request.post('/api/session', { data: { config: CUSTOM_CONFIG } })
  ).json() as { code: string; creatorToken: string };

  await joinAs(pageA, created.code, 'Ada', created.creatorToken);

  // B sees A appear in the roster on join (both still in the lobby).
  await joinAs(pageB, created.code, 'Bea');
  await expect(pageB.getByRole('listitem').filter({ hasText: 'Ada' })).toBeVisible({ timeout: 10_000 });
  await expect(pageA.getByRole('listitem').filter({ hasText: 'Bea' })).toBeVisible({ timeout: 10_000 });

  const adaHueOnB = await pageB
    .getByRole('listitem')
    .filter({ hasText: 'Ada' })
    .getByRole('img')
    .first()
    .getAttribute('data-hue');

  // Non-facilitated game: any participant (here, Ada) may start.
  await pageA.getByRole('button', { name: 'Start game' }).click();
  await expect(pageA.getByText('4 left')).toBeVisible({ timeout: 10_000 });

  // B expands the collapsed roster strip to watch progress during sort.
  await pageB.getByRole('button', { name: /Show participants/ }).click();
  const adaRowOnB = pageB.getByRole('listitem').filter({ hasText: 'Ada' });
  const adaHueDuringSort = await adaRowOnB.getByRole('img').first().getAttribute('data-hue');
  expect(adaHueDuringSort).toBe(adaHueOnB);

  // A sorts the whole (tiny) round: keep 2, discard 2 — no trim/rank, straight to result.
  // Each press's swipe-exit animation must resolve (SwipeCard.commit) before the next card
  // mounts and re-focuses itself, so waiting on the "N left" counter between presses avoids
  // a keypress landing while no card is focused (same pattern as solo-journey.spec.ts).
  await pageA.keyboard.press('ArrowRight'); // keep
  await expect(pageA.getByText('3 left')).toBeVisible({ timeout: 5000 });
  await expect(adaRowOnB).toContainText('1 sorted', { timeout: 10_000 });
  await pageA.keyboard.press('ArrowLeft'); // discard
  await expect(pageA.getByText('2 left')).toBeVisible({ timeout: 5000 });
  await pageA.keyboard.press('ArrowRight'); // keep
  await expect(pageA.getByText('1 left')).toBeVisible({ timeout: 5000 });
  await pageA.keyboard.press('ArrowLeft'); // discard

  await expect(pageA.getByRole('heading', { name: 'Presence E2E' })).toBeVisible({ timeout: 10_000 });
  await expect(adaRowOnB).toContainText('Done ✓', { timeout: 10_000 });

  // Invariant 1, end to end: every frame either side ever sent/received, and the DO's own
  // persisted storage, contain no card value/description outside the public deck config.
  assertNoCardLeak(framesA, 'A');
  assertNoCardLeak(framesB, 'B');

  const dump = await (await request.get(`/api/session/${created.code}/dump`)).json();
  assertNoCardLeak([JSON.stringify(dump)], 'DO storage');

  await contextA.close();
  await contextB.close();
});
