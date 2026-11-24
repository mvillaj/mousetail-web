import { describe, expect, it } from 'vitest';
import { HOME_TITLE, pageTitle } from './pageTitle';

describe('pageTitle', () => {
  it('uses the home title for the signed-out root and unknown paths', () => {
    expect(pageTitle('/')).toBe(HOME_TITLE);
    expect(HOME_TITLE).toBe('Mousetail - Shot log, dial-in coach and ES1 profiles');
    expect(pageTitle('/nope')).toBe(HOME_TITLE);
  });

  it('titles the signed-in root as the dashboard', () => {
    expect(pageTitle('/', true)).toBe('Dashboard | Mousetail');
  });

  it('puts the page before the site name with a pipe', () => {
    expect(pageTitle('/shots')).toBe('Shots | Mousetail');
    expect(pageTitle('/sign-in')).toBe('Sign in | Mousetail');
  });

  it('covers nested routes', () => {
    expect(pageTitle('/coffees/abc')).toBe('Coffees | Mousetail');
    expect(pageTitle('/profiles/new')).toBe('Profiles | Mousetail');
  });
});
