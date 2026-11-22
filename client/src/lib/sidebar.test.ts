import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SLIDE_OVER_MS, sidebarStartsOpen, slideProgress, useSidebar } from './sidebar';

const touch = (coarse: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
  }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSidebar', () => {
  it('starts as a rail, still, with nothing remembered', () => {
    const { result } = renderHook(() => useSidebar());
    expect(result.current).toMatchObject({ open: false, slide: null });
  });

  it('starts open by touch, where a rail has no tooltips, unless left as a rail', () => {
    touch(true);
    expect(sidebarStartsOpen()).toBe(true);
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.toggle(null));
    expect(sidebarStartsOpen()).toBe(false);
  });

  it('starts as a rail for a mouse', () => {
    touch(false);
    expect(sidebarStartsOpen()).toBe(false);
  });

  it('opens and closes, and is found as it was left', () => {
    const { result, unmount } = renderHook(() => useSidebar());
    act(() => result.current.toggle(null));
    expect(result.current).toMatchObject({ open: true, slide: { from: 0, turned: false } });
    unmount();

    // Open from the first render, and not as a movement to animate.
    const again = renderHook(() => useSidebar());
    expect(again.result.current).toMatchObject({ open: true, slide: null });
    act(() => again.result.current.toggle(null));
    expect(again.result.current.open).toBe(false);
    expect(sidebarStartsOpen()).toBe(false);
  });

  it('slides for a toggle, then is done, so nothing later replays it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.toggle(null));
    act(() => vi.advanceTimersByTime(SLIDE_OVER_MS - 1));
    expect(result.current.slide).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toMatchObject({ open: true, slide: null });
  });

  it('turns back from where it had got to, each time on the other curve', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.toggle(null));
    act(() => result.current.toggle(0.25));
    expect(result.current).toMatchObject({ open: false, slide: { from: 0.75, turned: true } });
    act(() => result.current.toggle(0.5));
    expect(result.current).toMatchObject({ open: true, slide: { from: 0.5, turned: false } });
    act(() => result.current.toggle(0.5));
    // The last one finished: this starts afresh.
    act(() => result.current.toggle(null));
    expect(result.current.slide).toEqual({ from: 0, turned: false });
  });

  it('still toggles where nothing can be stored', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useSidebar());
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle(null));
    expect(result.current.open).toBe(true);
  });
});

describe('slideProgress', () => {
  const sidebar = (animationName: string, progress: number | null) => {
    const el = document.createElement('aside');
    el.getAnimations = () =>
      [{ animationName, effect: { getComputedTiming: () => ({ progress }) } }] as never;
    return el;
  };

  it('reads the slide, and nothing else that may be running', () => {
    expect(slideProgress(sidebar('rail-open', 0.4))).toBe(0.4);
    expect(slideProgress(sidebar('rail-close', 0))).toBe(0);
    expect(slideProgress(sidebar('fade-in', 0.4))).toBeNull();
  });

  it('is null when still, or where animations cannot be read', () => {
    expect(slideProgress(sidebar('rail-open', null))).toBeNull();
    expect(slideProgress(document.createElement('aside'))).toBeNull();
    expect(slideProgress(null)).toBeNull();
  });
});
