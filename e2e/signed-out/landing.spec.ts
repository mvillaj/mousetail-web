import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('visitors get the landing page with a way in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chase the mouse tail');
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});

test('the photo fills the first screen, with one way in on it', async ({ page }) => {
  await page.goto('/');
  const photo = page.getByRole('img', { name: /espresso running/i });
  await expect(photo).toBeInViewport();
  const box = await photo.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(page.getByRole('link', { name: 'Create account' }).first()).toBeInViewport();
  await expect(page.getByRole('button', { name: /pull it again/i })).not.toBeInViewport();
  // The bar sits at the top of the photo, not pushed down by it.
  const bar = await page.locator('.splash .landing-bar').boundingBox();
  expect(bar!.y).toBeLessThan(10);
  expect(bar!.height).toBeLessThan(120);
});

test('a short window can still scroll to the splash press', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto('/');
  const press = page.locator('.splash').getByRole('link', { name: 'Create account' });
  await press.scrollIntoViewIfNeeded();
  await expect(press).toBeInViewport();
});

test('a dark finish still gets a press that shows on the photo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brewlab.finish', 'black'));
  await page.goto('/');
  const press = page.locator('.splash').getByRole('link', { name: 'Create account' });
  await expect(press).toHaveCSS('background-color', 'rgb(241, 235, 228)');
});

test('sign in opens the Clerk form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test('first-time visitors get light, even when the system prefers dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a saved dark choice survives a reload', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brewlab.theme', 'dark'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('the hero pull links each stage to its section', async ({ page }) => {
  await page.goto('/');
  const stages = page.getByRole('navigation', { name: 'What Mousetail does' });
  await stages.getByRole('link', { name: /Infusion/ }).click();
  await expect(page).toHaveURL(/#coach$/);
  await expect(
    page.getByRole('heading', { name: 'Then exactly one adjustment.', exact: true }),
  ).toBeInViewport();
});
