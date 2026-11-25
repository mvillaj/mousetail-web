import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { E2E_EMAIL } from '../constants';

// A session of its own: signing out ends only the current session, so the saved
// one the other signed-in specs load stays good.
test.use({ storageState: { cookies: [], origins: [] } });

test('signing out returns to the landing page without reloading', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.addInitScript(() => localStorage.setItem('brewlab.sidebar', 'rail'));
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: E2E_EMAIL });
  await page.goto('/shots');
  // As a rail, sign out is behind the initial.
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const signOut = page
    .getByRole('dialog', { name: 'Account' })
    .getByRole('button', { name: 'Sign out' });
  await expect(signOut).toBeVisible();

  let loads = 0;
  page.on('load', () => loads++);
  await signOut.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the mouse tail');
  // The landing shows before Clerk finishes signing out, and the reload this
  // guards against came a few hundred milliseconds after that, so give it time.
  await page.waitForTimeout(1500);
  expect(loads).toBe(0);
});
