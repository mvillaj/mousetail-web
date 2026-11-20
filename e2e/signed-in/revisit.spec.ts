import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('a page you come back to arrives with what it showed, while it refreshes', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Main' });
  await page.goto('/grinders');
  await expect(page.getByText('Opus 2').first()).toBeVisible();

  // From here the server is slow to say which grinders there are.
  let slowed = 0;
  await page.route('**/api/grinders', async (route) => {
    slowed += 1;
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  await nav.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await nav.getByRole('link', { name: 'Grinders' }).click();

  // Well inside the slowed answer: this can only be the remembered one.
  await expect(page.getByText('Opus 2').first()).toBeVisible({ timeout: 1000 });
  expect(slowed).toBeGreaterThan(0);
});
