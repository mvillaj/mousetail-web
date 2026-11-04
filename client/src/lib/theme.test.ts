import { afterEach, describe, expect, it } from 'vitest';
import { storedPref, syncThemeColor } from './theme';

describe('storedPref', () => {
  afterEach(() => localStorage.clear());

  it('gives a first-time visitor light', () => {
    expect(storedPref()).toBe('light');
  });

  it('keeps a choice once made, including auto', () => {
    for (const pref of ['light', 'dark', 'auto'] as const) {
      localStorage.setItem('brewlab.theme', pref);
      expect(storedPref()).toBe(pref);
    }
  });

  it('treats an unknown value as no choice', () => {
    localStorage.setItem('brewlab.theme', 'sepia');
    expect(storedPref()).toBe('light');
  });
});

describe('syncThemeColor', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.style.background = '';
  });

  it("copies the page's ground into the theme-color meta", () => {
    document.head.innerHTML = '<meta name="theme-color" content="#f7f3ee" />';
    document.body.style.background = 'rgb(21, 18, 17)';
    syncThemeColor();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      'rgb(21, 18, 17)',
    );
  });

  it('leaves the meta alone when the stylesheet has not painted a ground', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#f7f3ee" />';
    syncThemeColor();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#f7f3ee',
    );
  });
});
