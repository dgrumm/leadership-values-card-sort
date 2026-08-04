import { expect, test } from '@playwright/test';

/**
 * Spec 03.1's create flow, full stack against `wrangler dev` (see join.spec.ts).
 */
test('one-tap create: landing -> Start -> default template -> Create -> code + share link; a second browser joins and sees the classic config', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start a session' }).click();
  await expect(page).toHaveURL(/\/create$/);

  await page.getByLabel('Your name').fill('Coach');
  await page.getByRole('button', { name: 'Create game' }).click();

  // Code + share link shown.
  const shareLink = page.getByLabel('Share link');
  await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  const link = await shareLink.inputValue();
  const code = link.split('/').pop() as string;
  await expect(page.getByText(code, { exact: true })).toBeVisible();

  // Facilitation toggle (on by default for the classic template) -> the creator shows
  // up in the roster tagged as facilitator.
  await expect(page.getByText('Coach')).toBeVisible();
  const coachRow = page.locator('li', { hasText: 'Coach' });
  await expect(coachRow).toContainText('Facilitator');

  // Share link pre-fills the code on a fresh visit.
  const second = await browser.newContext();
  const bPage = await second.newPage();
  await bPage.goto(`/join/${code}`);
  await expect(bPage.locator('#session-code')).toHaveValue(code);

  await bPage.getByLabel('Display name').fill('Ada');
  await bPage.getByRole('button', { name: 'Join' }).click();

  // B sees the classic template's config in her own lobby.
  await expect(bPage.getByRole('heading', { name: 'Leadership Values — 40 → 8 → 3' })).toBeVisible({ timeout: 10_000 });
  await expect(bPage.getByText('Ada')).toBeVisible();

  await second.close();
});

test('lobby updateConfig broadcasts to joined participants; startGame locks the designer', async ({ page, browser }) => {
  await page.goto('/create');
  await page.getByLabel('Your name').fill('Coach');
  await page.getByRole('button', { name: 'Create game' }).click();

  const shareLink = page.getByLabel('Share link');
  await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  const code = (await shareLink.inputValue()).split('/').pop() as string;

  const second = await browser.newContext();
  const bPage = await second.newPage();
  await bPage.goto(`/join/${code}`);
  await bPage.getByLabel('Display name').fill('Ada');
  await bPage.getByRole('button', { name: 'Join' }).click();
  await expect(bPage.getByText('Ada')).toBeVisible({ timeout: 10_000 });

  // Creator reopens the designer and renames round 1.
  await page.getByRole('button', { name: 'Edit game' }).click();
  const roundName = page.locator('#round-0-name');
  await roundName.fill('Open triage (renamed)');
  await page.getByRole('button', { name: 'Save changes' }).click();

  // B's lobby reflects the change without reloading.
  await expect(bPage.getByText(/Open triage \(renamed\)/)).toBeVisible({ timeout: 10_000 });

  // Starting the game locks config: the designer controls disappear for the facilitator.
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('button', { name: 'Edit game' })).toHaveCount(0, { timeout: 10_000 });

  await second.close();
});

// Regression: the facilitator who reached /sort via the Create page dropped into the
// standalone local demo instead of the real session, because CreateLobby's redirect never
// recorded the session code (Join.tsx did; Create.tsx didn't). Presence tests created
// sessions via the API and joined everyone, so they never exercised the creator's redirect.
// This drives the real Create-page path and asserts both players are in ONE live session.
test('facilitator created via the Create page joins the real session on /sort, not the demo', async ({ page, browser }) => {
  await page.goto('/create');
  await page.getByLabel('Your name').fill('Coach');
  await page.getByRole('button', { name: 'Create game' }).click();

  const shareLink = page.getByLabel('Share link');
  await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  const code = (await shareLink.inputValue()).split('/').pop() as string;

  const second = await browser.newContext();
  const bPage = await second.newPage();
  await bPage.goto(`/join/${code}`);
  await bPage.getByLabel('Display name').fill('Ada');
  await bPage.getByRole('button', { name: 'Join' }).click();
  await expect(bPage.getByText('Ada')).toBeVisible({ timeout: 10_000 });

  // Facilitator starts; both clients land on /sort in the SAME session.
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });
  await expect(bPage).toHaveURL(/\/sort$/, { timeout: 10_000 });

  // The demo route has no shared roster and could never show the other participant. The
  // facilitator seeing "Ada" proves they're in the real multiplayer session.
  await page.getByRole('button', { name: /Show participants/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Ada' })).toBeVisible({ timeout: 10_000 });

  // And progress flows facilitator -> joiner: Coach sorts one card, Ada's roster reflects it.
  await bPage.getByRole('button', { name: /Show participants/ }).click();
  await page.locator('body').click();
  // 00.4 removed the mount autofocus, so the card must be Tab'd to before Arrow keys reach it.
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  await expect(bPage.getByRole('listitem').filter({ hasText: 'Coach' })).toContainText('1 sorted', {
    timeout: 10_000,
  });

  await second.close();
});
