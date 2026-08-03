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
