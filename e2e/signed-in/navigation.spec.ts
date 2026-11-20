import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __viewTransitions: number;
  }
}

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  // Count the view transitions React starts, without changing what they do.
  await page.addInitScript(() => {
    window.__viewTransitions = 0;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((...args: Parameters<typeof start>) => {
      window.__viewTransitions += 1;
      return start(...args);
    }) as typeof document.startViewTransition;
  });
});

const transitions = (page: Page) => page.evaluate(() => window.__viewTransitions);

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
  await expect(page.locator('html')).toHaveAttribute('data-navigation', 'push');

  // Back is popstate. React may or may not run it as a transition, so the
  // page marks it and the CSS keeps it still either way.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Shot log' })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-navigation', 'pop');
});
