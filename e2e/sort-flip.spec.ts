import { expect, test } from '@playwright/test';
import { sortTopCard, turnOverIfFaceDown } from './deck';

/**
 * 01.5 — the card faces, asserted in a real browser.
 *
 * These run against the dev server, which renders under `StrictMode`. That
 * matters: the first implementation guarded the reveal with a has-mounted ref,
 * which survives StrictMode's effect/cleanup/effect cycle, so the deck revealed
 * itself on mount. Every jsdom test passed and the feature did not work. The
 * face-down assertions below are the ones that catch that class of bug.
 */

test('a fresh round opens face-down and cannot be sorted until turned over', async ({ page }) => {
  await page.goto('/sort');
  await expect(page.getByText('12 left')).toBeVisible();

  // Face-down: the front face is not in the DOM, so no card value is readable
  // and neither commit control exists.
  await expect(page.getByTestId('card-front')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Keep / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Discard / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Turn over' })).toBeVisible();
  await expect(page.locator('[data-flipped="true"]').first()).toBeVisible();
});

test('turning over reveals the card and arms the commit controls', async ({ page }) => {
  await page.goto('/sort');
  await page.getByRole('button', { name: 'Turn over' }).click();

  await expect(page.getByTestId('card-front').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Keep / })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Discard / })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn over' })).toHaveCount(0);
  // Still 12 left: turning over is not a commit.
  await expect(page.getByText('12 left')).toBeVisible();
});

test('the deck can be started from the keyboard alone', async ({ page }) => {
  await page.goto('/sort');
  await page.locator('[role="group"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Keep / })).toBeVisible();
});

test('arrow keys are inert while the card is face-down', async ({ page }) => {
  await page.goto('/sort');
  await page.locator('[role="group"]').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  // Nothing committed — the deck is untouched and the card is still face-down.
  await expect(page.getByText('12 left')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn over' })).toBeVisible();
});

test('the next card is never face-up beneath the active card', async ({ page }) => {
  await page.goto('/sort');
  await turnOverIfFaceDown(page);
  // Exactly one front face on screen: the active card. Everything beneath it is
  // face-down, not rendered at low opacity (the 01.3 spoiler this replaces).
  await expect(page.getByTestId('card-front')).toHaveCount(1);
  // The deck has thickness: the next card plus DECK_DEPTH static backs. All
  // face-down, so none of them can be read.
  await expect(page.locator('[data-flipped="true"]')).toHaveCount(3);
});

test('subsequent cards arrive face-up — the flip happens during the exit, not after it', async ({
  page,
}) => {
  await page.goto('/sort');
  await sortTopCard(page, 'keep');
  await expect(page.getByText('11 left')).toBeVisible({ timeout: 3000 });
  // No second turn-over control: the card the participant watched flip is now
  // the active card, already face-up.
  await expect(page.getByRole('button', { name: 'Turn over' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Keep / })).toBeVisible();
});

test('a mid-round refresh restores the active card face-up (invariant 4)', async ({ page }) => {
  await page.goto('/sort');
  for (let i = 0; i < 3; i++) {
    const remainingBefore = 12 - i;
    await sortTopCard(page, i % 2 === 0 ? 'keep' : 'discard');
    await expect(page.getByText(`${remainingBefore - 1} left`)).toBeVisible({ timeout: 3000 });
  }

  await page.reload();
  await expect(page.getByText('9 left')).toBeVisible();
  // Someone three cards deep has begun; they must not be handed a face-down card.
  await expect(page.getByRole('button', { name: 'Turn over' })).toHaveCount(0);
  await expect(page.getByTestId('card-front').first()).toBeVisible();
});

test('the flip is a real 3D turn, and collapses to a fade under reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/sort');
  const rotating = page.locator('[data-flipped]').first();

  // Face-down at rest: a rotated 3D matrix, and the 3D context that makes the
  // face swap land at the 90° midpoint rather than at flip start.
  const faceDown = await rotating.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    transformStyle: getComputedStyle(el).transformStyle,
    perspective: getComputedStyle(el.parentElement as HTMLElement).perspective,
  }));
  expect(faceDown.transform).toMatch(/^matrix3d/);
  expect(faceDown.transformStyle).toBe('preserve-3d');
  expect(faceDown.perspective).not.toBe('none');

  // The back face must actually be hidden from the reverse side, or the flip
  // shows value text on a card that is still turned away.
  const backfaceVisibility = await page
    .getByTestId('card-back')
    .first()
    .evaluate((el) => getComputedStyle(el).backfaceVisibility);
  expect(backfaceVisibility).toBe('hidden');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const reducedTransform = await page
    .locator('[data-flipped="true"]')
    .first()
    .evaluate((el) => getComputedStyle(el).transform);
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(reducedTransform);
});

test('the deck card really rotates during the commit — not a face swap', async ({ page }) => {
  // Regression guard. The first implementation resolved the deck card's *start*
  // face from `flipped`, which is already false by the time the commit remounts
  // it — so it animated front-to-front and popped face-up with
  // `transform: none`. Every "ends face-up" assertion still passed. Only
  // sampling the rotation mid-commit catches that.
  await page.goto('/sort');
  await page.getByRole('button', { name: 'Turn over' }).click();
  await expect(page.getByTestId('card-front').first()).toBeVisible();

  await page.evaluate(() => {
    const w = window as unknown as { __samples: string[]; __sampling: boolean };
    w.__samples = [];
    w.__sampling = true;
    const tick = () => {
      // Target the turning card by name: the deck's static backs are also
      // [data-flipped], so DOM order is not a safe handle. The active card's drag
      // rotation lives on an ancestor, so any intermediate value read here can
      // only come from the flip.
      const el = document.querySelector('[data-testid="deck-card"] [data-flipped]');
      if (el) w.__samples.push(getComputedStyle(el).transform);
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.getByRole('button', { name: /^Keep / }).click();
  await page.waitForTimeout(800);

  const samples = await page.evaluate(() => {
    const w = window as unknown as { __samples: string[]; __sampling: boolean };
    w.__sampling = false;
    return w.__samples;
  });

  // matrix3d's first component is cos(rotateY): 1 face-up, -1 face-down.
  const cosines = samples
    .filter((s) => s.startsWith('matrix3d'))
    .map((s) => Number(s.slice('matrix3d('.length).split(',')[0]));
  expect(cosines.length).toBeGreaterThan(0);

  // A real turn passes through intermediate angles. `transform: none` yields no
  // matrix3d samples at all, and a hard 180 -> 0 jump yields only ±1.
  const midTurn = cosines.filter((c) => c > -0.9 && c < 0.9);
  expect(midTurn.length).toBeGreaterThan(2);
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 720 },
]) {
  test(`the deck never reaches the control row at ${viewport.name} (${viewport.width}px)`, async ({
    page,
  }) => {
    // The stack hangs below the active card, and the commit controls sit just
    // beneath it — at a step of 8px the deepest back overhung the buttons by 8px.
    // This holds the geometry rather than the constant, so raising DECK_DEPTH or
    // DECK_STEP_PX without making room fails here instead of in review.
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/sort');

    // Measures the *resting* layout. A card mid-rotation projects a taller box
    // under perspective, which is the turn itself and not a layout fault, so this
    // polls until the motion settles rather than sampling a transient frame.
    async function assertClear(label: string) {
      const overhang = async () =>
        page.evaluate(() => {
          const bottoms = [...document.querySelectorAll('[data-flipped]')].map(
            (el) => el.getBoundingClientRect().bottom,
          );
          // Whichever commit control is showing: Turn over while face-down, ✗/✓ after.
          const control =
            document.querySelector('button[aria-label^="Discard"]') ??
            [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Turn over');
          if (!control) return Number.NaN;
          return Math.max(...bottoms) - control.getBoundingClientRect().top;
        });
      await expect
        .poll(overhang, { message: `${label}: deck overhangs the control row at rest`, timeout: 3000 })
        .toBeLessThan(0);
    }

    await assertClear('face-down');
    await page.getByRole('button', { name: 'Turn over' }).click();
    await expect(page.getByRole('button', { name: /^Keep / })).toBeVisible();
    await assertClear('face-up');
  });
}
