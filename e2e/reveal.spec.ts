import { expect, test, type Locator, type Page } from '@playwright/test';

interface RevealTestState {
  participants: Record<string, { name: string }>;
  reveals: Record<string, Record<number, { cards: { value: string }[]; ranked: boolean }>>;
}

/**
 * Two rounds so the flow crosses both reveal surfaces the spec calls out: the
 * round-complete interstitial (round 1, unranked) and the final result screen
 * (round 2, ranked) — the latter also proves rank order survives end to end.
 */
const CONFIG = {
  title: 'Reveal E2E',
  deck: {
    name: 'Mini',
    cards: [
      { value: 'Alpha', description: 'never sent unrevealed' },
      { value: 'Beta', description: 'never sent unrevealed' },
      { value: 'Gamma', description: 'never sent unrevealed' },
      { value: 'Delta', description: 'never sent unrevealed' },
      { value: 'Epsilon', description: 'never sent unrevealed' },
      { value: 'Zeta', description: 'never sent unrevealed' },
    ],
  },
  rounds: [
    { name: 'Round 1', keep: 4, rank: false },
    { name: 'Round 2', keep: 2, rank: true },
  ],
  theme: { variant: 'default' },
  facilitated: false,
};

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

/** Clicks Keep/Discard `count` times, returns the card values kept, in click order. */
async function resolveQueue(page: Page, count: number, keep: (index: number) => boolean): Promise<string[]> {
  const kept: string[] = [];
  for (let i = 0; i < count; i++) {
    const remainingBefore = count - i;
    const wantKeep = keep(i);
    const button = page.getByRole('button', { name: wantKeep ? /^Keep / : /^Discard / });
    const label = await button.getAttribute('aria-label');
    if (wantKeep && label) kept.push(label.replace(/^Keep /, ''));
    await button.click();
    if (remainingBefore - 1 > 0) {
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
    }
  }
  return kept;
}

async function orderOf(items: Locator): Promise<string[]> {
  const count = await items.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).locator('p').first().textContent();
    names.push((text ?? '').replace(/^\d+\.\s*/, ''));
  }
  return names;
}

/** Pointer-drags the first rank item down past the second (same technique as
 *  round-flow-refresh.spec.ts) — enough to prove order isn't coincidentally kept-order. */
async function reorderFirstItemDown(page: Page, items: Locator): Promise<string[]> {
  const before = await orderOf(items);
  const handle = items.first().getByRole('button');
  const box = await handle.boundingBox();
  if (!box) throw new Error('rank handle not found');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(60); // dnd-kit's trailing synthetic click window
  const after = await orderOf(items);
  if (after.join('|') === before.join('|')) throw new Error('pointer reorder never changed the rank order');
  return after;
}

async function stateOn(page: Page): Promise<RevealTestState | null | undefined> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __VC_TEST__?: unknown }).__VC_TEST__),
    { timeout: 10_000 },
  );
  return page.evaluate(
    () => (window as unknown as { __VC_TEST__?: { getState: () => unknown } }).__VC_TEST__?.getState() as
      | RevealTestState
      | null
      | undefined,
  );
}

async function participantIdByName(page: Page, name: string): Promise<string> {
  const state = await stateOn(page);
  const [id] = Object.entries(state?.participants ?? {}).find(([, p]) => p.name === name) ?? [];
  if (!id) throw new Error(`no participant named ${name}`);
  return id;
}

test('reveal: explainer once, round-complete and final-round reveal reach the other participant, order preserved, un-reveal deletes', async ({
  browser,
  request,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const created = (await (
    await request.post('/api/session', { data: { config: CONFIG } })
  ).json()) as { code: string; creatorToken: string };

  await joinAs(pageA, created.code, 'Ada', created.creatorToken);
  await joinAs(pageB, created.code, 'Bea');
  await pageA.getByRole('button', { name: 'Start game' }).click();
  await expect(pageA.getByText('6 left')).toBeVisible({ timeout: 10_000 });

  const aId = await participantIdByName(pageB, 'Ada');

  // Before any reveal, B's session state has no reveals bucket for A at all.
  const beforeReveal = await stateOn(pageB);
  expect(beforeReveal?.reveals[aId]).toBeUndefined();

  // Round 1: keep exactly 4 (no trim needed) -> round-complete interstitial.
  const round1Kept = await resolveQueue(pageA, 6, (i) => i < 4);
  await expect(pageA.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible({ timeout: 10_000 });

  // First-ever reveal in this browser: the explainer appears, focus-trapped (Modal, 00.3),
  // and Confirm proceeds to the actual reveal.
  await pageA.getByRole('button', { name: 'Reveal' }).click();
  const explainer = pageA.getByRole('dialog', { name: 'Sharing your result' });
  await expect(explainer).toBeVisible();
  expect(await pageA.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  await pageA.getByRole('button', { name: 'Got it, share' }).click();
  await expect(pageA.getByRole('status').filter({ hasText: 'Shared ✓' })).toBeVisible({ timeout: 10_000 });

  // B's session state gains exactly A's round-1 snapshot (cards, unordered round -> compare as a set).
  await expect
    .poll(async () => {
      const state = await stateOn(pageB);
      return state?.reveals[aId]?.[1]?.cards.map((c) => c.value).sort();
    }, { timeout: 10_000 })
    .toEqual([...round1Kept].sort());

  // A server-side rejection (round 1 is write-once, already revealed) surfaces as a Toast
  // and the client stays functional — Continue still works right after.
  await pageA.evaluate(
    ({ participantId }) => {
      (window as unknown as { __VC_TEST__?: { send: (intent: Record<string, unknown>) => void } }).__VC_TEST__?.send({
        type: 'reveal',
        intentId: crypto.randomUUID(),
        participantId,
        round: 1,
        snapshot: { cards: [], ranked: false, revealedAt: Date.now() },
      });
    },
    { participantId: aId },
  );
  await expect(pageA.getByText(/already been revealed/)).toBeVisible({ timeout: 10_000 });

  await pageA.getByRole('button', { name: 'Continue' }).click();

  // Round 2 (final, ranked): keep exactly 2, discard 2 -> straight to RankBoard.
  await expect(pageA.getByText('4 left')).toBeVisible({ timeout: 10_000 });
  await resolveQueue(pageA, 4, (i) => i < 2);
  await expect(pageA.getByRole('heading', { name: 'Rank your final cards' })).toBeVisible({ timeout: 10_000 });

  const reordered = await reorderFirstItemDown(pageA, pageA.getByRole('listitem'));
  await pageA.getByRole('button', { name: 'Confirm order' }).click();
  await expect(pageA.getByRole('heading', { name: 'Reveal E2E' })).toBeVisible({ timeout: 10_000 });

  // Explainer already seen this browser — the second reveal skips straight through.
  await pageA.getByRole('button', { name: 'Reveal' }).click();
  await expect(pageA.getByRole('dialog')).toHaveCount(0);
  await expect(pageA.getByRole('status').filter({ hasText: 'Shared ✓' })).toBeVisible({ timeout: 10_000 });

  // B receives A's exact rank order, not kept-order or alphabetical.
  await expect
    .poll(async () => {
      const state = await stateOn(pageB);
      return state?.reveals[aId]?.[2]?.cards.map((c) => c.value);
    }, { timeout: 10_000 })
    .toEqual(reordered);

  // Un-reveal deletes the snapshot for everyone; re-reveal brings the same order straight back.
  await pageA.getByRole('button', { name: 'Un-reveal' }).click();
  await expect
    .poll(async () => (await stateOn(pageB))?.reveals[aId]?.[2], { timeout: 10_000 })
    .toBeUndefined();

  await pageA.getByRole('button', { name: 'Reveal' }).click();
  await expect
    .poll(async () => {
      const state = await stateOn(pageB);
      return state?.reveals[aId]?.[2]?.cards.map((c) => c.value);
    }, { timeout: 10_000 })
    .toEqual(reordered);

  await contextA.close();
  await contextB.close();
});
