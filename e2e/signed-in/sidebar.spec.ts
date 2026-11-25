import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

// Playwright hides scrollbars; the nav's is part of what's checked here.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  // A first visit opens the menu; these start from the rail unless a test has left it
  // open, or it's by touch, which is checked on a first visit.
  await page.addInitScript(() => {
    if (matchMedia('(pointer: coarse)').matches) return;
    if (!localStorage.getItem('brewlab.sidebar')) localStorage.setItem('brewlab.sidebar', 'rail');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
});

const sidebar = (page: Page) => page.getByRole('complementary');
const width = (page: Page) => sidebar(page).evaluate((el) => el.getBoundingClientRect().width);
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Shot log' });
const expand = (page: Page) => page.getByRole('button', { name: 'Expand menu' });
const collapse = (page: Page) => page.getByRole('button', { name: 'Collapse menu' });
const icon = (page: Page) =>
  sidebar(page).getByRole('link', { name: 'Grinders' }).locator('.nav-icon');
/** Whatever is moving has finished, so positions can be read. A skeleton's pulse never does. */
const settled = (page: Page) =>
  page.evaluate(async () => {
    const ending = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.allSettled(ending.map((a) => a.finished));
  });

async function openShotLog(page: Page) {
  await page.goto('/shots');
  await expect(heading(page)).toBeVisible();
}

test('toggles between a rail and a menu that makes room for itself, and is remembered', async ({
  page,
}) => {
  await openShotLog(page);
  expect(await width(page)).toBe(72);
  const before = (await heading(page).boundingBox())!;
  const iconAt = await icon(page).boundingBox();

  await expand(page).click();
  await expect.poll(() => width(page)).toBe(248);
  await settled(page);
  // The page moves over by what the sidebar gained; no icon moves.
  expect((await heading(page).boundingBox())!.x).toBe(before.x + 176);
  expect(await icon(page).boundingBox()).toEqual(iconAt);

  // Left open, it's open on the next load, from the start and without moving.
  await page.reload();
  await expect(heading(page)).toBeVisible();
  expect(await width(page)).toBe(248);
  await expect(page.locator('.shell')).not.toHaveAttribute('data-moved');

  await collapse(page).click();
  await expect.poll(() => width(page)).toBe(72);
  await settled(page);
  expect((await heading(page).boundingBox())!.x).toBe(before.x);
  // Over with, so it can't play again.
  await expect(page.locator('.shell')).not.toHaveAttribute('data-moved');
});

test('turned back part-way, it goes from where it was', async ({ page }) => {
  await openShotLog(page);
  // Frozen mid-slide, so what's read on either side of the toggle is comparable.
  const { before, after } = await page.evaluate(async () => {
    const frame = () => new Promise(requestAnimationFrame);
    const toggle = document.querySelector<HTMLElement>('.sidebar-toggle')!;
    const main = document.querySelector('.main')!;
    const aside = document.querySelector('.sidebar')!;
    const slide = () =>
      [...main.getAnimations(), ...aside.getAnimations()].filter((a) =>
        /^(rail|page)-/.test((a as CSSAnimation).animationName),
      );
    const edge = () => {
      const clip = getComputedStyle(aside).clipPath.match(/[\d.]+px/g) ?? [];
      const right = clip.length > 1 ? parseFloat(clip[1]) : 0;
      return [main.getBoundingClientRect().x, aside.getBoundingClientRect().width - right];
    };
    toggle.click();
    await frame();
    await frame();
    for (const a of slide()) {
      a.pause();
      a.currentTime = 120;
    }
    const before = edge();
    toggle.click();
    await Promise.resolve();
    for (const a of slide()) {
      a.pause();
      a.currentTime = 0;
    }
    return { before, after: edge() };
  });
  // Well under way, or this proves nothing.
  expect(before[0]).toBeGreaterThan(90);
  expect(before[0]).toBeLessThan(230);
  for (const i of [0, 1]) expect(Math.abs(after[i] - before[i])).toBeLessThan(1);
});

test('the rail covers nothing of the page', async ({ page }) => {
  await page.goto('/profiles/new');
  const back = page.locator('.page-head .back');
  await expect(back).toBeVisible();
  // Its whole length, under where the unwritten word is.
  const covered = await back.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const xs = Array.from({ length: 9 }, (_, i) => r.left + 1 + ((r.width - 2) * i) / 8);
    return xs.filter((x) => !el.contains(document.elementFromPoint(x, r.top + r.height / 2)));
  });
  expect(covered).toEqual([]);
  await back.click();
  await expect(page).toHaveURL(/\/profiles$/);
});

test('keyboard focus in the rail is named, and ringed all the way round', async ({ page }) => {
  await openShotLog(page);
  const label = page.locator('.rail-label');
  await page.getByRole('link', { name: 'Shot log' }).hover();
  await expect(label).toHaveCount(0);
  await sidebar(page).getByRole('link', { name: 'Dashboard' }).focus();
  await page.keyboard.press('Tab');
  const link = sidebar(page).getByRole('link', { name: 'Shot log' });
  await expect(link).toBeFocused();
  await expect(label).toHaveText('Shot log');
  const [tip, row] = [(await label.boundingBox())!, (await link.boundingBox())!];
  expect(tip.x).toBeGreaterThan(row.x + row.width);
  expect(Math.abs(tip.y + tip.height / 2 - (row.y + row.height / 2))).toBeLessThan(1);

  // The nav scrolls, so it cuts off anything past its edges.
  const spare = await link.evaluate((a) => {
    const nav = a.closest('.nav')!;
    const { outlineWidth, outlineOffset } = getComputedStyle(a);
    const ring = a.getBoundingClientRect().right + parseFloat(outlineWidth);
    return nav.getBoundingClientRect().left + nav.clientWidth - ring - parseFloat(outlineOffset);
  });
  expect(spare).toBeGreaterThanOrEqual(0);

  await page.keyboard.press('Escape');
  await expect(label).toHaveCount(0);

  // On a short window, focus scrolls the nav, and the name stays with its row.
  await page.setViewportSize({ width: 1440, height: 520 });
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  await expect
    .poll(async () => {
      const [t, r] = [await label.boundingBox(), await page.locator(':focus').boundingBox()];
      return Math.abs(t!.y + t!.height / 2 - (r!.y + r!.height / 2));
    })
    .toBeLessThan(1);
});

test('beside a notch, the rail is moved over, not squeezed', async ({ page }) => {
  await openShotLog(page);
  const row = icon(page).locator('xpath=ancestor::a');
  const before = (await row.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 59 } });
  await expect.poll(() => width(page)).toBe(72 + 59);
  expect(await row.boundingBox()).toEqual({ ...before, x: before.x + 59 });
  await expand(page).click();
  await settled(page);
  expect(await width(page)).toBe(248 + 59);
});

test.describe('by touch', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('it starts open, with controls a finger can hit', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await openShotLog(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect(await width(page)).toBe(248);
    expect((await collapse(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // Left as a rail, it stays one.
    await collapse(page).tap();
    await settled(page);
    await page.reload();
    await expect(heading(page)).toBeVisible();
    expect(await width(page)).toBe(72);
    const initial = page.getByRole('button', { name: 'Account', exact: true });
    const reach = await initial.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
      const at = (dx: number, dy: number) => document.elementFromPoint(x + dx, y + dy) === el;
      return [at(-21, 0), at(21, 0), at(0, -21), at(0, 21)];
    });
    expect(reach).toEqual([true, true, true, true]);
  });
});

test('stays as it is under the pointer', async ({ page }) => {
  await openShotLog(page);
  await page.mouse.move(36, 300);
  await page.waitForTimeout(800);
  expect(await width(page)).toBe(72);
});

test('the ring becomes the wordmark, and back', async ({ page }) => {
  await openShotLog(page);
  const word = sidebar(page).locator('.brand-word');
  const ink = sidebar(page).locator('.ring-round');
  await expect(word).toHaveCSS('clip-path', 'inset(0px 100% 0px 0px)');
  await expect(ink).toHaveCSS('opacity', '1');
  // It's named either way.
  await expect(sidebar(page).locator('.brand-lockup')).toHaveText('mousetail');

  await expand(page).click();
  // The drop falls from the tail, as on the sign-in page, rather than sliding in.
  const falling = () =>
    sidebar(page)
      .locator('.brand-drop')
      .evaluate((el) =>
        el.getAnimations().some((a) => (a as CSSAnimation).animationName === 'brand-drop'),
      );
  await expect.poll(falling, { intervals: [10] }).toBe(true);
  // Written in, not switched: part-way there at some point on the way.
  const partial = () =>
    word.evaluate((el) => {
      const right = parseFloat(getComputedStyle(el).clipPath.split(' ')[1] ?? '0');
      return right > 5 && right < 95;
    });
  await expect.poll(partial, { intervals: [10] }).toBe(true);
  await settled(page);
  await expect(word).toHaveCSS('clip-path', 'inset(0px)');
  await expect(ink).toHaveCSS('opacity', '0');

  // The ring's drop lets go, and the wordmark's own is what's left.
  await expect(sidebar(page).locator('.ring-drop')).toHaveCSS('opacity', '0');
  await expect(sidebar(page).locator('.brand-drop')).toHaveCSS('opacity', '1');

  await collapse(page).click();
  await settled(page);
  await expect(ink).toHaveCSS('opacity', '1');
  await expect(word).toHaveCSS('clip-path', 'inset(0px 100% 0px 0px)');
});

test('changes at once under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openShotLog(page);
  await expand(page).click();
  expect(await width(page)).toBe(248);
  const moving = await sidebar(page).evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .map((a) => (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName)
      // Hovering the button tints it, whatever the motion preference.
      .filter((name) => !['background-color', 'color'].includes(name)),
  );
  expect(moving).toEqual([]);
});

test('the rail names its icons, and its links work', async ({ page }) => {
  await openShotLog(page);
  const grinders = sidebar(page).getByRole('link', { name: 'Grinders' });
  await expect(grinders).toHaveAttribute('title', 'Grinders');
  await grinders.click();
  await expect(page).toHaveURL(/\/grinders$/);
});

test('the rail has the account, theme and sign out behind the initial', async ({ page }) => {
  await openShotLog(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const pop = page.getByRole('dialog', { name: 'Account' });
  await expect(pop.getByRole('button', { name: 'Sign out' })).toBeVisible();
  // It's far wider than the rail; none of it is cut off.
  expect(
    await pop.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.right - 4, r.top + r.height / 2));
    }),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();

  // Toggling the sidebar shuts it too.
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expand(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.settings-pop')).toHaveCount(0);

  // Open, the row has them directly.
  await settled(page);
  await page.getByRole('button', { name: 'Theme and colour' }).click();
  await expect(page.getByRole('dialog', { name: 'Theme and colour' })).toBeVisible();
});

test('a short window fades the menu where there is more of it, with a way on', async ({ page }) => {
  await openShotLog(page);
  const frame = page.locator('.nav-frame');
  const nav = sidebar(page).getByRole('navigation', { name: 'Main' });
  const more = page.locator('.nav-more');
  const pill = () => icon(page).evaluate((el) => el.closest('a')!.getBoundingClientRect().width);

  // It all fits: nothing to say.
  await expect(frame).not.toHaveAttribute('data-more-below');
  await expect(more).toHaveCSS('opacity', '0');
  const wide = await pill();

  await page.setViewportSize({ width: 1440, height: 520 });
  await expect(frame).toHaveAttribute('data-more-below', 'true');
  await expect(frame).not.toHaveAttribute('data-more-above');
  await expect(more).toHaveCSS('opacity', '1');
  // The scrollbar is thin, and takes nothing from the rows.
  const bar = await nav.evaluate((el) => (el as HTMLElement).offsetWidth - el.clientWidth);
  expect(bar).toBe(4);
  expect(await pill()).toBe(wide);

  await more.click();
  await expect(frame).toHaveAttribute('data-more-above', 'true');
  await nav.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(frame).not.toHaveAttribute('data-more-below');
  await expect(more).toHaveCSS('opacity', '0');
});

test("a short window shows the menu's scrollbar only while it is scrolled", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  // Arriving scrolls the menu to the current page, which isn't anyone scrolling.
  await page.goto('/changelog');
  const frame = page.locator('.nav-frame');
  await expect(frame).toHaveAttribute('data-more-above', 'true');
  const thumb = () =>
    sidebar(page)
      .getByRole('navigation', { name: 'Main' })
      .evaluate((el) => getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor);
  expect(await thumb()).toBe('rgba(0, 0, 0, 0)');
  await expect(frame).not.toHaveAttribute('data-scrolling');

  await page.mouse.move(36, 200);
  await page.mouse.wheel(0, -60);
  await expect(frame).toHaveAttribute('data-scrolling', 'true');
  await expect.poll(thumb).not.toBe('rgba(0, 0, 0, 0)');
  await expect(frame).not.toHaveAttribute('data-scrolling');
  await expect.poll(thumb).toBe('rgba(0, 0, 0, 0)');
});

test('a short window keeps the current page, and what you tab to, clear of the fade', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.goto('/grinders');
  await expect(page.getByRole('heading', { level: 1, name: 'Grinders' })).toBeVisible();
  const clear = (name: string) =>
    sidebar(page)
      .getByRole('link', { name })
      .evaluate((a) => {
        const nav = a.closest('.nav')!;
        const v = nav.getBoundingClientRect();
        const r = a.getBoundingClientRect();
        const atEnd = nav.scrollHeight - nav.clientHeight - nav.scrollTop < 3;
        return (nav.scrollTop < 3 || r.top >= v.top + 39) && (atEnd || r.bottom <= v.bottom - 51);
      });
  for (const [name, path] of [
    ['Grinders', '/grinders'],
    ['Explore', '/explore'],
    ['My account', '/account'],
    ['Changelog', '/changelog'],
    ['Profiles', '/profiles'],
  ]) {
    await page.goto(path);
    await expect(sidebar(page).getByRole('link', { name })).toHaveClass(/active/);
    expect(await clear(name), name).toBe(true);
  }
  await sidebar(page).getByRole('link', { name: 'Dashboard' }).focus();
  for (const name of ['Shot log', 'Profiles', 'Machines', 'Grinders', 'My coffees', 'Explore']) {
    await page.keyboard.press('Tab');
    expect(await clear(name), `tab to ${name}`).toBe(true);
  }
});

test('a window made shorter keeps the current page in the menu', async ({ page }) => {
  await page.goto('/changelog');
  const link = sidebar(page).getByRole('link', { name: 'Changelog' });
  await expect(link).toHaveClass(/active/);
  const inView = () =>
    link.evaluate((a) => {
      const v = a.closest('.nav')!.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      return r.top >= v.top && r.bottom <= v.bottom + 1;
    });
  await page.setViewportSize({ width: 1440, height: 520 });
  await expect.poll(inView).toBe(true);
  // The page put it there, so there's no scrollbar to show.
  await expect(page.locator('.nav-frame')).not.toHaveAttribute('data-scrolling');

  // Scrolled away from on purpose, it's left alone.
  const nav = sidebar(page).getByRole('navigation', { name: 'Main' });
  await nav.evaluate((el) => (el.scrollTop = 0));
  await page.setViewportSize({ width: 1440, height: 480 });
  await page.waitForTimeout(300);
  expect(await nav.evaluate((el) => el.scrollTop)).toBe(0);

  // Back from too narrow for a sidebar, it's in view again.
  await page.setViewportSize({ width: 600, height: 480 });
  await expect(sidebar(page)).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 480 });
  await expect.poll(inView).toBe(true);
});

test('phones keep the tab bar, with no rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/shots');
  await expect(heading(page)).toBeVisible();
  await expect(sidebar(page)).toBeHidden();
  await expect(page.locator('.tabbar')).toBeVisible();
});
