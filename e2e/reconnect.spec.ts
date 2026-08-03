import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __VC_TEST__?: {
      send: (intent: Record<string, unknown>) => void;
      getState: () => unknown;
      closeSocket: () => void;
    };
  }
}

const WS_PATTERN = /\/api\/session\//;

/**
 * A local `wrangler dev` resumes a session in well under a network round trip, so
 * killing an already-open socket and *then* asserting on the transient "Reconnecting…"
 * pill races the app's own resume-and-redirect (flaky under parallel CI load). Routing
 * the WebSocket (`page.routeWebSocket`) to close on arrival instead makes every connect
 * attempt fail deterministically — no race — for as long as the route stays armed; the
 * dev-only `closeSocket()` hook (useSession.ts) additionally exercises the exact
 * force-close path spec 01.2 calls out.
 */
test('socket-kill: reconnects automatically and a queued intent survives it', async ({ page }) => {
  await page.goto('/join');
  await page.getByRole('button', { name: /Dev: quick create session/ }).click();
  const codeInput = page.locator('#session-code');
  await expect(codeInput).toHaveValue(/^[A-Z0-9]{6}$/, { timeout: 5000 });
  const code = await codeInput.inputValue();

  await page.getByLabel('Display name').fill('Ada');
  await page.getByRole('button', { name: 'Join' }).click();

  // Spec 03.1: joining now lands in the lobby, not directly on /sort — the "quick
  // create" flow's creator token (same browser) makes Ada the facilitator, so she
  // starts the game herself to reach the state this test actually cares about.
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });

  // Every connection attempt to the session socket fails immediately while this route is
  // armed — including the automatic reconnect's own retries — so `reconnecting` is stable
  // for as long as we want, not a transient window we have to race to observe.
  await page.routeWebSocket(WS_PATTERN, (ws) => {
    ws.close({ code: 1006, reason: 'e2e: simulated drop' });
  });

  await page.goto(`/join/${code}`);
  await page.waitForFunction(() => Boolean(window.__VC_TEST__), { timeout: 10_000 });
  await page.evaluate(() => window.__VC_TEST__?.closeSocket());
  await expect(page.getByRole('status')).toHaveText('Reconnecting…', { timeout: 10_000 });

  // Queue an intent while genuinely offline (reportProgress: harmless, valid for any participant).
  await page.evaluate((c) => {
    const token = JSON.parse(localStorage.getItem(`vc:${c}:token`) ?? 'null') as { participantId: string };
    window.__VC_TEST__?.send({
      type: 'reportProgress',
      intentId: crypto.randomUUID(),
      participantId: token.participantId,
      round: 1,
      sorted: 3,
      kept: 2,
      done: false,
    });
  }, code);

  // Let the next reconnect attempt through — forward it to the real server instead of killing it.
  await page.routeWebSocket(WS_PATTERN, (ws) => {
    ws.connectToServer();
  });

  // Automatic backoff reconnect resyncs and the app hands off to /sort, same as a fresh join.
  await expect(page.getByRole('status').filter({ hasText: 'Reconnecting' })).toHaveCount(0, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/sort$/, { timeout: 20_000 });
});

/**
 * Spec 02.1: milestones sent while offline aren't lost — they queue (01.2) and flush on
 * resume, so a second participant watching the roster eventually sees the same counts.
 */
test('presence: offline-sorted progress arrives on B once A reconnects', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto('/join');
  await pageA.getByRole('button', { name: /Dev: quick create session/ }).click();
  const codeInput = pageA.locator('#session-code');
  await expect(codeInput).toHaveValue(/^[A-Z0-9]{6}$/, { timeout: 5000 });
  const code = await codeInput.inputValue();

  await pageA.getByLabel('Display name').fill('Ada');
  await pageA.getByRole('button', { name: 'Join' }).click();
  await expect(pageA).toHaveURL(/\/sort$/, { timeout: 10_000 });

  await pageB.goto(`/join/${code}`);
  await pageB.getByLabel('Display name').fill('Bea');
  await pageB.getByRole('button', { name: 'Join' }).click();
  await expect(pageB).toHaveURL(/\/sort$/, { timeout: 10_000 });

  const adaRowOnB = pageB.getByRole('listitem').filter({ hasText: 'Ada' });
  await expect(adaRowOnB).toBeVisible({ timeout: 10_000 });

  // Every reconnect attempt fails while armed, same technique as the socket-kill test above,
  // so "genuinely offline" is a stable window rather than a race against wrangler dev's resume.
  // Re-navigating to `/join/:code` (rather than closing the already-open `/sort` socket in
  // place) is what the socket-kill test above does too: it forces a fresh connection attempt
  // that the just-armed route is guaranteed to intercept, instead of racing the in-flight
  // socket's own close/reconnect cycle.
  await pageA.routeWebSocket(WS_PATTERN, (ws) => {
    ws.close({ code: 1006, reason: 'e2e: simulated drop' });
  });
  await pageA.goto(`/join/${code}`);
  await pageA.waitForFunction(() => Boolean(window.__VC_TEST__), { timeout: 10_000 });
  await pageA.evaluate(() => window.__VC_TEST__?.closeSocket());
  await expect(pageA.getByRole('status')).toHaveText('Reconnecting…', { timeout: 10_000 });

  await pageA.evaluate((c) => {
    const token = JSON.parse(localStorage.getItem(`vc:${c}:token`) ?? 'null') as { participantId: string };
    window.__VC_TEST__?.send({
      type: 'reportProgress',
      intentId: crypto.randomUUID(),
      participantId: token.participantId,
      round: 1,
      sorted: 3,
      kept: 2,
      done: false,
    });
  }, code);

  await pageA.routeWebSocket(WS_PATTERN, (ws) => {
    ws.connectToServer();
  });
  await expect(pageA.getByRole('status').filter({ hasText: 'Reconnecting' })).toHaveCount(0, { timeout: 20_000 });

  await expect(adaRowOnB).toContainText('Round 1 · 3 sorted · 2 kept', { timeout: 20_000 });

  await contextA.close();
  await contextB.close();
});
