import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test("the grind setting is held to the default grinder's dial", async ({ page }) => {
  await page.goto('/shots');
  await page.getByRole('button', { name: 'Log a shot' }).click();
  // The ES1 opens the simple form; the grind check lives on the detailed one.
  await page.getByRole('button', { name: 'Detailed' }).click();

  // Getting started put the Opus 2 on the bench: a stepless 0-10 dial.
  const grind = page.getByLabel(/Grind setting/);
  await grind.fill('12');
  await expect(page.getByText('Fellow Opus 2 goes from 0 to 10')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log shot' })).toBeDisabled();

  await grind.fill('1');
  await expect(page.getByText(/≈ 300 µm/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log shot' })).toBeEnabled();
});

test('an ES1 gets the simple shot form first, with the full form one tap away', async ({
  page,
}) => {
  await page.goto('/shots');
  await page.evaluate(() => localStorage.removeItem('brewlab.shotFormMode'));
  await page.getByRole('button', { name: 'Log a shot' }).click();

  // The profile fixes dose, yield and time, so none of those are asked for.
  await expect(page.getByLabel(/^Dose/)).toBeHidden();

  await page.getByRole('button', { name: 'Detailed' }).click();
  await expect(page.getByLabel(/^Dose/)).toBeVisible();

  await page.getByRole('button', { name: 'Simple' }).click();
  await expect(page.getByLabel(/^Dose/)).toBeHidden();
});
