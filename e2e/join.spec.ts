import { expect, test } from '@playwright/test';

/**
 * Full stack against `wrangler dev` (playwright.config.ts runs it as a second
 * webServer, proxied under /api by Vite) — the real Session DO from spec 01.1.
 */
test('join flow: code + name -> roster contains self', async ({ page }) => {
  await page.goto('/join');
  await page.getByRole('button', { name: /Dev: quick create session/ }).click();
  const codeInput = page.locator('#session-code');
  await expect(codeInput).toHaveValue(/^[A-Z0-9]{6}$/, { timeout: 5000 });
  const code = await codeInput.inputValue();

  await page.getByLabel('Display name').fill('Ada');
  await page.getByRole('button', { name: 'Join' }).click();

  // The join hand-off only redirects once the DO's `state` event has this
  // participant in `participants` (Join.tsx's JoiningSession effect) — a
  // successful redirect *is* the roster-contains-self assertion.
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });

  const token: unknown = await page.evaluate((c) => {
    const raw = localStorage.getItem(`vc:${c}:token`);
    return raw ? JSON.parse(raw) : null;
  }, code);
  expect(token).toMatchObject({
    participantId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    participantToken: expect.any(String),
  });
});
