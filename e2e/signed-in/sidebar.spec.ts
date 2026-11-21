import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.setViewportSize({ width: 1440, height: 900 });
});

const sidebar = (page: Page) => page.getByRole('complementary');
const width = (page: Page) => sidebar(page).evaluate((el) => el.getBoundingClientRect().width);
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Shot log' });

async function openShotLog(page: Page) {
  await page.goto('/shots');
  await expect(heading(page)).toBeVisible();
  await page.mouse.move(900, 500);
  await expect.poll(() => width(page)).toBe(72);
}

test('rests as a rail, opens over the page when the pointer rests on it, and closes after', async ({
  page,
}) => {
  await openShotLog(page);
  const before = await heading(page).boundingBox();
  await expect(sidebar(page).locator('.nav-text').first()).toHaveCSS('opacity', '0');

  await page.mouse.move(36, 300);
  await expect.poll(() => width(page)).toBe(248);
  await expect(sidebar(page).locator('.nav-text').first()).toHaveCSS('opacity', '1');
  // It covered the page rather than pushing it.
  expect(await heading(page).boundingBox()).toEqual(before);

  await page.mouse.move(900, 500);
  await expect.poll(() => width(page)).toBe(72);
});

test('opens at once when you tab into it', async ({ page }) => {
  await openShotLog(page);
  await page.keyboard.press('Tab');
  await expect(sidebar(page)).toHaveAttribute('data-expanded', 'true');
  await expect(page.locator(':focus')).toHaveCount(1);
  expect(await sidebar(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

test('its links work straight from the rail', async ({ page }) => {
  await openShotLog(page);
  await sidebar(page).getByRole('link', { name: 'Grinders' }).click();
  await expect(page).toHaveURL(/\/grinders$/);
});

test('phones keep the tab bar, with no rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/shots');
  await expect(heading(page)).toBeVisible();
  await expect(sidebar(page)).toBeHidden();
  await expect(page.locator('.tabbar')).toBeVisible();
});
