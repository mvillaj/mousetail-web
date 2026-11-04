import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('a signed-in brewer lands on their dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shot log' }).first()).toBeVisible();
});

test('getting started put the chosen grinder and machine on the bench', async ({ page }) => {
  await page.goto('/grinders');
  await expect(page.getByText('Opus 2').first()).toBeVisible();
  await page.goto('/machines');
  await expect(page.getByText(/ES1|Espresso Series 1/).first()).toBeVisible();
});

// A reload draws from one request: /auth/me carries the bench, so /machines
// is not asked for on the way in. A slow one fills in the shell's frame
// rather than putting up a status message.
test('a slow reload fills in the shell and asks for the bench only once', async ({ page }) => {
  const machineCalls: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/machines') machineCalls.push(r.url());
  });
  await page.route('**/api/auth/me', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Loading');
  await expect(page.getByText(/warming up/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: /, E2E$/ })).toBeVisible();
  expect(machineCalls).toEqual([]);
});

// On a phone the shell's grid once shared a short page's spare height with the
// top bar, so while the dashboard loaded the bar sat mid-screen and the whole
// page jumped up when the cards landed.
test('on a phone, the top bar and greeting hold still while the dashboard loads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/shots**', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });

  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1, name: /, E2E$/ });
  await expect(heading).toBeVisible();
  const bar = page.locator('header.topbar');
  const before = { bar: await bar.boundingBox(), heading: await heading.boundingBox() };
  expect(before.bar?.y).toBe(0);

  await expect(page.getByRole('heading', { name: 'Recent shots' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dial-in progress' })).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect((await bar.boundingBox())?.y).toBe(0);
  expect(Math.abs((await heading.boundingBox())!.y - before.heading!.y)).toBeLessThan(2);
});
