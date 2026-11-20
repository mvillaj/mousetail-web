import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  // Count the view transitions React starts, without changing what they do.
  await page.addInitScript(() => {
    const w = window as unknown as { __viewTransitions: number };
    w.__viewTransitions = 0;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      w.__viewTransitions += 1;
      return start(arg);
    }) as typeof document.startViewTransition;
  });
});

const transitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __viewTransitions: number }).__viewTransitions);

test('following a link is a view transition, but launch is not', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  expect(await transitions(page)).toBe(0);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Shot log' })
    .click();
  await expect(page).toHaveURL(/\/shots$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Shot log' })).toBeVisible();
  await expect.poll(() => transitions(page)).toBe(1);

  // Back is popstate, which React renders at once, transition or not. All
  // that matters is that it lands on the old page.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Shot log' })).toHaveCount(0);
});
