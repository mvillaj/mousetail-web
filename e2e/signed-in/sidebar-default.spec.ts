import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test('a first visit opens the menu, with labels', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/shots');
  await expect(page.getByRole('heading', { level: 1, name: 'Shot log' })).toBeVisible();
  await expect(page.locator('.shell')).toHaveAttribute('data-sidebar', 'open');
  await expect(page.getByRole('button', { name: 'Collapse menu' })).toBeVisible();
  const width = await page
    .getByRole('complementary')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBe(248);
});
