import { expect, type Page } from '@playwright/test';

const TURN_OVER = 'Turn over';
const COMMIT = /^(Keep|Discard) /;

/**
 * Waits until the deck has rendered a control, so callers decide against a
 * settled screen. Without this, a bare `isVisible()` runs before the sort screen
 * mounts, reports false, and the turn-over is silently skipped — which then hangs
 * on a commit button that never appears because the card is still face-down.
 */
async function waitForDeck(page: Page) {
  const turnOver = page.getByRole('button', { name: TURN_OVER });
  const commit = page.getByRole('button', { name: COMMIT });
  await expect(turnOver.or(commit).first()).toBeVisible({ timeout: 10_000 });
  return turnOver;
}

/**
 * Turn over the top card if the deck is face-down (01.5).
 *
 * Tolerant by design: a round opens face-down, but a *resumed* round comes back
 * face-up, and rounds 2+ open face-down again. Callers that just want to sort a
 * card shouldn't have to track which case they're in.
 */
export async function turnOverIfFaceDown(page: Page): Promise<void> {
  const turnOver = await waitForDeck(page);
  if (await turnOver.isVisible()) {
    await turnOver.click();
  }
}

/**
 * Keyboard-only equivalent of {@link turnOverIfFaceDown}. Assumes the card group
 * already has focus — Enter on the focused card is the keyboard path to turning
 * it over, and keyboard-only journeys must never fall back to a click.
 */
export async function turnOverIfFaceDownWithKeyboard(page: Page): Promise<void> {
  const turnOver = await waitForDeck(page);
  if (await turnOver.isVisible()) {
    await page.keyboard.press('Enter');
  }
}

/** Sort the top card, turning it over first if it is still face-down. */
export async function sortTopCard(page: Page, decision: 'keep' | 'discard'): Promise<void> {
  await turnOverIfFaceDown(page);
  const label = decision === 'keep' ? /^Keep / : /^Discard /;
  await page.getByRole('button', { name: label }).click();
}
