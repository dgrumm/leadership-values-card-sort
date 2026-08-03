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
 * Two browsers, same session: A's connection dot on B's roster flips hollow within 5s of
 * A dropping, and fills back in once A rejoins (spec 02.1's connection dot criterion).
 * Arms `routeWebSocket` to fail every reconnect attempt while observing the disconnected
 * state — same technique as `e2e/reconnect.spec.ts` — so the transient isn't a race against
 * `wrangler dev`'s (sub-network-round-trip) resume time.
 */
test('presence-connection: A dropping flips A hollow on B, rejoin fills it back in', async ({ browser }) => {
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

  const adaDot = pageB.getByRole('listitem').filter({ hasText: 'Ada' }).locator('[data-connected]');
  await expect(adaDot).toHaveAttribute('data-connected', 'true', { timeout: 10_000 });

  // Fail every reconnect attempt from here so "disconnected" is stable, not a transient window.
  await pageA.routeWebSocket(WS_PATTERN, (ws) => {
    ws.close({ code: 1006, reason: 'e2e: simulated drop' });
  });
  await pageA.waitForFunction(() => Boolean(window.__VC_TEST__), { timeout: 10_000 });
  await pageA.evaluate(() => window.__VC_TEST__?.closeSocket());

  await expect(adaDot).toHaveAttribute('data-connected', 'false', { timeout: 5000 });

  // Let the next reconnect attempt through — A rejoins for real.
  await pageA.routeWebSocket(WS_PATTERN, (ws) => {
    ws.connectToServer();
  });

  await expect(adaDot).toHaveAttribute('data-connected', 'true', { timeout: 20_000 });

  await contextA.close();
  await contextB.close();
});
