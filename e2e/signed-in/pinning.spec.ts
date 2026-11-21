import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

/** Adds a coffee through the form, as someone would, and comes back to the shelf. */
async function addCoffee(page: Page, name: string) {
  await page.goto('/coffees');
  await page.getByRole('button', { name: 'Add coffee' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add coffee' });
  await dialog.getByLabel('Coffee name').fill(name);
  await dialog.getByLabel('Roaster').fill('E2E Roasters');
  await dialog.getByRole('button', { name: 'Add coffee' }).click();
  await expect(page).toHaveURL(/\/coffees\/[^/]+$/);
}

test('pin a coffee to the top of the shelf, and it stays pinned', async ({ page }) => {
  // Unique per run, like coffees.spec.ts: the Clerk user outlives the database.
  const stamp = Date.now();
  const first = `E2E Pin First ${stamp}`;
  const second = `E2E Pin Second ${stamp}`;
  await addCoffee(page, first);
  await addCoffee(page, second);

  await page.goto('/coffees');
  const pinned = page.getByRole('region', { name: 'Pinned' });
  const shelf = page.getByRole('region', { name: 'On the shelf' });
  // The older of the two goes to the top.
  await page.getByRole('button', { name: `Pin ${first}` }).click();
  await expect(pinned.getByRole('link', { name: first })).toBeVisible();
  await expect(page.getByRole('button', { name: `Pin ${first}` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Saved on the server, not just moved on screen.
  await page.reload();
  await expect(pinned.getByRole('link', { name: first })).toBeVisible();
  await expect(shelf.getByRole('link', { name: second })).toBeVisible();

  await page.getByRole('button', { name: `Pin ${first}` }).click();
  await expect(pinned.getByRole('link', { name: first })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: first })).toBeVisible();
  await expect(page.getByRole('button', { name: `Pin ${first}` })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
