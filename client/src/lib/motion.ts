/**
 * Loads motion's engine for LazyMotion (see main.tsx) and says when it's in.
 *
 * Until then, motion elements sit still in their `initial` state, so anything
 * that needs the engine to look right checks `motionReady()` or the
 * `data-motion="ready"` it sets on <html> (the nav's CSS hover background is
 * the fallback until then). If the engine can't load, that's logged and the
 * fallbacks simply stay.
 *
 * Keep this file free of static imports from `motion`: it's on the first-load
 * path, and the engine must stay in its own chunk.
 */
export function loadMotionFeatures() {
  return import('./motionFeatures').then(
    (engine) => {
      document.documentElement.dataset.motion = 'ready';
      return engine.default;
    },
    (error: unknown) => {
      console.warn('Animations are off: the motion engine did not load.', error);
      // Never resolves: LazyMotion keeps waiting, and the fallbacks stay.
      return new Promise<never>(() => {});
    },
  );
}

/** Whether the engine is in, so animations will actually run. */
export const motionReady = () => document.documentElement.dataset.motion === 'ready';
