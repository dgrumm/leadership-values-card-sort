import { expect, test } from '@playwright/test';
import { sortTopCard, turnOverIfFaceDown } from './deck';

// 12 cards with values that don't collide with any bundled deck's real content, so a
// match against them can only have come from this pasted CSV.
const CUSTOM_CSV = Array.from({ length: 12 }, (_, i) => `Zyxwv ${i + 1},Custom value ${i + 1}`).join('\n');
const CARD_VALUE_PATTERN = /^Zyxwv \d+$/;

/**
 * Spec 03.2's full-stack path: paste a custom CSV deck at create time, create the
 * game, start it, and prove the sorted card really came from the pasted CSV (not a
 * bundled deck) — plus a second browser sees the custom deck name in its own lobby.
 */
test('paste a custom deck CSV, create, start, and sort a card from that deck; a second browser sees the custom deck name', async ({
  page,
  browser,
}) => {
  await page.goto('/create');
  await page.getByLabel('Your name').fill('Coach');
  await page.getByRole('button', { name: 'Customize' }).click();

  await page.getByLabel(/Paste CSV/).fill(CUSTOM_CSV);
  // Scoped to a <p> — the bundled "Dev 12" deck-picker option also happens to read "12
  // cards" (in a <span>), which a bare text match would collide with.
  await expect(page.getByRole('paragraph').filter({ hasText: '12 cards' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zyxwv 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Use this deck' }).click();
  await expect(page.getByText('Remove custom deck')).toBeVisible();

  await page.getByRole('button', { name: 'Create game' }).click();

  const shareLink = page.getByLabel('Share link');
  await expect(shareLink).toHaveValue(/\/join\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  const code = (await shareLink.inputValue()).split('/').pop() as string;

  // Second browser joins and sees the custom deck's name (not a bundled deck's) in
  // its own lobby, before the game starts.
  const second = await browser.newContext();
  const bPage = await second.newPage();
  await bPage.goto(`/join/${code}`);
  await bPage.getByLabel('Display name').fill('Ada');
  await bPage.getByRole('button', { name: 'Join' }).click();
  await expect(bPage.getByText(/Custom deck \(12 cards\)/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });

  await turnOverIfFaceDown(page);
  const cardTitle = await page.getByTestId('card-front').locator('h3').textContent();
  expect(cardTitle?.trim()).toMatch(CARD_VALUE_PATTERN);

  await sortTopCard(page, 'keep');
  await page.getByRole('button', { name: /Kept cards: 1/ }).click();
  await expect(page.getByText(cardTitle!.trim(), { exact: true })).toBeVisible({ timeout: 3000 });

  await second.close();
});
