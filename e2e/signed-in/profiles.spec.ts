import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

// The suite runs with no model key, so this checks the coffee start is offered
// and explains itself, without spending a real suggestion.
test('the new-profile picker offers a coffee start next to the factory ones', async ({ page }) => {
  await page.goto('/profiles');
  await page.getByRole('button', { name: 'New profile' }).click();

  const dialog = page.getByRole('dialog', { name: 'Start from' });
  await expect(dialog.getByRole('heading', { name: 'Designed for a coffee' })).toBeVisible();
  await expect(dialog.getByText(/ANTHROPIC_API_KEY/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Blank profile/ })).toBeVisible();
});
