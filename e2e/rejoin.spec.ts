import { expect, test } from '@playwright/test';

/**
 * PRD invariant 4 (membership half): a same-browser revisit of a session URL
 * silently resumes — no name prompt, same participant UUID.
 */
test('reload on the same join URL resumes silently with the same participant UUID', async ({ page }) => {
  await page.goto('/join');
  await page.getByRole('button', { name: /Dev: quick create session/ }).click();
  const codeInput = page.locator('#session-code');
  await expect(codeInput).toHaveValue(/^[A-Z0-9]{6}$/, { timeout: 5000 });
  const code = await codeInput.inputValue();

  await page.getByLabel('Display name').fill('Ada');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });

  const originalParticipantId: string = await page.evaluate((c) => {
    return (JSON.parse(localStorage.getItem(`vc:${c}:token`) ?? 'null') as { participantId: string }).participantId;
  }, code);

  // Revisit the join URL directly (not /sort) — this is where the "no re-join form" contract lives.
  await page.goto(`/join/${code}`);
  await expect(page.getByRole('heading', { name: 'Join a game' })).toHaveCount(0);
  await expect(page.getByLabel('Display name')).toHaveCount(0);

  await expect(page).toHaveURL(/\/sort$/, { timeout: 10_000 });

  const resumedParticipantId: string = await page.evaluate((c) => {
    return (JSON.parse(localStorage.getItem(`vc:${c}:token`) ?? 'null') as { participantId: string }).participantId;
  }, code);
  expect(resumedParticipantId).toBe(originalParticipantId);
});
