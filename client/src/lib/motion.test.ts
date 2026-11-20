import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.doUnmock('./motionFeatures');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('loadMotionFeatures', () => {
  it('hands LazyMotion the engine and marks the page ready', async () => {
    const { loadMotionFeatures, motionReady } = await import('./motion');
    expect(motionReady()).toBe(false);
    const engine = await loadMotionFeatures();
    expect(engine).toBeTruthy();
    expect(motionReady()).toBe(true);
    expect(document.documentElement.dataset.motion).toBe('ready');
  });

  it('leaves the fallbacks in place, and says so, when the engine fails to load', async () => {
    vi.doMock('./motionFeatures', () => {
      throw new Error('chunk failed');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadMotionFeatures, motionReady } = await import('./motion');
    const settled = vi.fn();
    void loadMotionFeatures().then(settled, settled);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(motionReady()).toBe(false);
    // LazyMotion keeps waiting rather than getting an error.
    expect(settled).not.toHaveBeenCalled();
  });
});
