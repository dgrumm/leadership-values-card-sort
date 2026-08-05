import { expect, test, type Page } from '@playwright/test';

/** One round, unranked, keep-all-4 — the wall itself is the thing under test, not
 *  round mechanics (already covered by reveal.spec.ts). */
const CONFIG = {
  title: 'Wall E2E',
  deck: {
    name: 'Mini',
    cards: [
      { value: 'Alpha', description: 'd' },
      { value: 'Beta', description: 'd' },
      { value: 'Gamma', description: 'd' },
      { value: 'Delta', description: 'd' },
    ],
  },
  rounds: [{ name: 'Round 1', keep: 4, rank: false }],
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

async function revealAll(page: Page) {
  for (let i = 0; i < 4; i++) {
    const remainingBefore = 4 - i;
    await page.getByRole('button', { name: /^Keep /, exact: false }).first().click();
    if (remainingBefore - 1 > 0) {
      // Wait for the sort store's next card to actually mount before the next click —
      // firing all four clicks back to back can outrun the re-render (see reveal.spec.ts's
      // resolveQueue, which does the same).
      await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 5000 });
    }
  }
  await expect(page.getByRole('button', { name: 'Reveal' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Reveal' }).click();
  const explainer = page.getByRole('dialog');
  if (await explainer.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Got it, share' }).click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'Shared ✓' })).toBeVisible({ timeout: 10_000 });
}

async function createSession(request: import('@playwright/test').APIRequestContext) {
  return (await (await request.post('/api/session', { data: { config: CONFIG } })).json()) as {
    code: string;
    creatorToken: string;
  };
}

test('wall: reveal/un-reveal are live across browsers with no refresh', async ({ browser, request }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const created = await createSession(request);
  await joinAs(pageA, created.code, 'Ada', created.creatorToken);
  await joinAs(pageB, created.code, 'Bea');
  // Starting the game is a single shared-session mutation (the facilitator's) — every
  // connected participant, B included, sees phase flip to `active` from that one click.
  await pageA.getByRole('button', { name: 'Start game' }).click();

  await pageB.goto(`/wall/${created.code}`);
  await expect(pageB.getByText(/No results yet/)).toBeVisible({ timeout: 10_000 });

  await revealAll(pageA);

  // B's already-open wall gains Ada's plaque with no reload.
  await expect(pageB.getByText('Ada')).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText('Alpha')).toBeVisible();

  await pageA.getByRole('button', { name: 'Un-reveal' }).click();
  await expect(pageB.getByText('Ada')).not.toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText(/No results yet/)).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test('wall: spotlight enlarges on every view and only the facilitator or owner may release; a participant may not spotlight another', async ({
  browser,
  request,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const created = await createSession(request);
  await joinAs(pageA, created.code, 'Ada', created.creatorToken); // facilitator
  await joinAs(pageB, created.code, 'Bea');
  await pageA.getByRole('button', { name: 'Start game' }).click();
  await revealAll(pageA);
  await revealAll(pageB);

  await pageA.goto(`/wall/${created.code}`);
  await pageB.goto(`/wall/${created.code}`);
  await expect(pageA.getByText('Bea')).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText('Bea')).toBeVisible({ timeout: 10_000 });

  // Bea (non-facilitator) cannot spotlight Ada's plaque — the control is disabled.
  const beaOnPageB = pageB.getByRole('button', { name: "Spotlight Ada's round 1 result" });
  await expect(beaOnPageB).toBeDisabled();

  // The facilitator spotlights Bea — it enlarges (a "Release spotlight" affordance
  // appears) on both connected wall views.
  await pageA.getByRole('button', { name: "Spotlight Bea's round 1 result" }).click();
  await expect(pageA.getByRole('button', { name: 'Release spotlight' })).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByRole('button', { name: 'Release spotlight' })).toBeVisible({ timeout: 10_000 });

  // Bea owns the spotlit plaque, so she may release it too (Esc).
  await pageB.keyboard.press('Escape');
  await expect(pageA.getByRole('button', { name: 'Release spotlight' })).not.toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByRole('button', { name: 'Release spotlight' })).not.toBeVisible({ timeout: 10_000 });

  await contextA.close();
  await contextB.close();
});

test('wall: projector mode hides chrome and stays live', async ({ browser, request }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const created = await createSession(request);
  await joinAs(pageA, created.code, 'Ada', created.creatorToken);
  await joinAs(pageB, created.code, 'Bea');
  await pageA.getByRole('button', { name: 'Start game' }).click();

  await pageB.goto(`/wall/${created.code}`);
  await expect(pageB.getByRole('heading', { name: /Wall/ })).toBeVisible({ timeout: 10_000 });

  await pageB.getByRole('button', { name: 'Projector mode' }).click();
  await expect(pageB.getByRole('heading', { name: /Wall/ })).not.toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByRole('button', { name: 'Exit projector' })).toBeVisible();

  await revealAll(pageA);
  await expect(pageB.getByText('Ada')).toBeVisible({ timeout: 10_000 });

  await contextA.close();
  await contextB.close();
});

test('wall: a concluded session remains reachable, and is actually read-only (server rejects mutation)', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const created = await createSession(request);
  await joinAs(page, created.code, 'Ada', created.creatorToken);
  await page.getByRole('button', { name: 'Start game' }).click();
  await revealAll(page);

  const participantId = await page.evaluate(
    (code) => (JSON.parse(localStorage.getItem(`vc:${code}:token`) ?? '{}') as { participantId?: string }).participantId,
    created.code,
  );
  // `conclude` sent while still on /sort — routes/Sort.tsx auto-redirects to the wall
  // once phase flips to `concluded` (the wall is the natural end state), so this test
  // waits for that redirect rather than racing it with its own `page.goto`.
  await page.evaluate((id) => {
    (window as unknown as { __VC_TEST__?: { send: (intent: Record<string, unknown>) => void } }).__VC_TEST__?.send({
      type: 'conclude',
      intentId: crypto.randomUUID(),
      participantId: id,
    });
  }, participantId);

  await expect(page).toHaveURL(new RegExp(`/wall/${created.code}$`), { timeout: 10_000 });
  await expect(page.getByText('Ada')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Alpha')).toBeVisible();
  await expect(page.getByText('Concluded · read-only', { exact: true })).toBeVisible();

  // The spotlight control is disabled in the UI...
  await expect(page.getByRole('button', { name: "Spotlight Ada's round 1 result" })).toBeDisabled();

  // ...and the DO itself — the one writer (tenet 1) — rejects a spotlight mutation even
  // sent directly, bypassing the disabled control: read-only is enforced server-side, not
  // just by the client hiding a button.
  await page.evaluate((id) => {
    (window as unknown as { __VC_TEST__?: { send: (intent: Record<string, unknown>) => void } }).__VC_TEST__?.send({
      type: 'setSpotlight',
      intentId: crypto.randomUUID(),
      participantId: id,
      target: id,
    });
  }, participantId);
  await expect(
    page.getByText('this session has concluded; the wall is read-only', { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Release spotlight' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Ada')).toBeVisible({ timeout: 10_000 });

  await context.close();
});

test('wall: responsive — single column at 390px, multi-column grid at 1440px', async ({ browser, request }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const created = await createSession(request);
  await joinAs(page, created.code, 'Ada', created.creatorToken);
  await page.getByRole('button', { name: 'Start game' }).click();
  await revealAll(page);
  await page.goto(`/wall/${created.code}`);
  await expect(page.getByText('Ada')).toBeVisible({ timeout: 10_000 });

  const grid = page.locator('[class*="grid"]', { has: page.getByText('Ada') }).first();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(grid).toHaveCSS('grid-template-columns', /^[^ ]+$/); // exactly one track
  await page.screenshot({ path: 'test-results/wall-mobile-390.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopColumns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(desktopColumns).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/wall-desktop-1440.png' });

  await context.close();
});
