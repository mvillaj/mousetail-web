import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

/** One brew profile: the ES1's simple form asks for one before it shows the dial. */
const PROFILE = {
  id: 'prf_e2e_motion',
  userId: 'usr_e2e',
  name: 'Classic',
  description: null,
  isPublic: false,
  syncState: 'local',
  fellowProfileId: null,
  lastPushedAt: null,
  origin: 'local',
  sourceDeviceId: null,
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: '2026-10-11T00:00:00Z',
  profile: {
    id: 'prf_e2e_motion',
    name: 'Classic',
    doseG: 18,
    ratio: 2,
    brewTempC: 93,
    stages: [
      {
        id: 's1',
        kind: 'preinfusion',
        durationS: 6,
        pressureBar: 3,
        endPressureBar: 3,
        flowLimitMlS: 3,
      },
      {
        id: 's2',
        kind: 'infusion',
        durationS: 24,
        pressureBar: 8,
        endPressureBar: 8,
        flowLimitMlS: 3,
      },
    ],
  },
};

/** The simple shot form, which has the grind dial and the stars. */
async function openShotForm(page: Page) {
  await page.route('**/api/profiles', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [PROFILE] }) : route.continue(),
  );
  await page.goto('/shots');
  await page.evaluate(() => localStorage.removeItem('brewlab.shotFormMode'));
  await page.getByRole('button', { name: 'Log a shot' }).click();
  await expect(page.getByLabel(/where was the grinder set/i)).toBeVisible();
}

test('the nav pill follows the pointer, settles on one link, and fades on leaving', async ({
  page,
}) => {
  await page.goto('/shots');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const pills = nav.locator('.nav-hover');

  await nav.getByRole('link', { name: 'Grinders' }).hover();
  await expect(nav.getByRole('link', { name: 'Grinders' }).locator('.nav-hover')).toHaveCount(1);

  await nav.getByRole('link', { name: 'Machines' }).hover();
  await expect(nav.getByRole('link', { name: 'Machines' }).locator('.nav-hover')).toHaveCount(1);
  await expect(pills).toHaveCount(1);

  await page.mouse.move(900, 500);
  await expect(pills).toHaveCount(0);
});

test('the grind dial rolls its digits, and is a plain input to type into', async ({ page }) => {
  await openShotForm(page);
  const input = page.getByLabel(/where was the grinder set/i);
  const rolling = page.locator('.grind-dial-rolling');

  await page.getByRole('button', { name: 'Raise the setting' }).click();
  await page.getByRole('button', { name: 'Raise the setting' }).click();
  const value = await input.inputValue();
  expect(value).not.toBe('');
  await expect(rolling).toBeVisible();
  await expect(rolling.locator('[data-digit]')).toHaveCount(value.replace(/\D/g, '').length);
  const shown = await rolling
    .locator('[data-digit]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.digit).join(''));
  expect(shown).toBe(value.replace(/\D/g, ''));

  await input.focus();
  await expect(rolling).toBeHidden();
  await input.fill('3');
  await expect(input).toHaveValue('3');
});

test('raising the rating throws sparks from the star you clicked', async ({ page }) => {
  await openShotForm(page);
  const four = page.getByRole('button', { name: '4 stars' });
  await four.click();
  await expect(four).toHaveAttribute('aria-pressed', 'true');
  expect(await four.locator('.rating-spark').count()).toBeGreaterThan(0);
});

test('under reduced motion, rating throws no sparks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openShotForm(page);
  const four = page.getByRole('button', { name: '4 stars' });
  await four.click();
  await expect(four).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.rating-spark')).toHaveCount(0);
});
