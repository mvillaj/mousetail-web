import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react';

/** How long the pointer rests before it opens, and lingers away before it closes. */
export const OPEN_AFTER_MS = 300;
export const CLOSE_AFTER_MS = 200;

/**
 * Whether something should be open because you mean to use it: the pointer
 * has rested on it a moment (so passing over on the way elsewhere doesn't
 * open it), or the keyboard has moved focus into it (at once: no waiting
 * when you tabbed there on purpose). It closes a moment after the pointer
 * leaves, or as soon as keyboard focus does.
 *
 * Touch is ignored, and so is focus from a click or tap: either would leave it
 * open with no pointer to leave and close it.
 *
 * Spread `props` onto the element; `open` says whether it's open.
 */
export function useHoverIntent() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hovered = useRef(false);
  const keyboardFocus = useRef(false);

  // Whether the last thing the person did was press a key, rather than point.
  const byKey = useRef(false);
  useEffect(() => {
    const key = () => (byKey.current = true);
    const point = () => (byKey.current = false);
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', point, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', point, true);
      clearTimeout(timer.current);
    };
  }, []);

  const settle = (next: boolean, ms: number) => {
    clearTimeout(timer.current);
    if (ms === 0) setOpen(next);
    else timer.current = setTimeout(() => setOpen(next), ms);
  };

  const props = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      hovered.current = true;
      settle(true, OPEN_AFTER_MS);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      hovered.current = false;
      if (!keyboardFocus.current) settle(false, CLOSE_AFTER_MS);
    },
    onFocus: () => {
      if (!byKey.current) return;
      keyboardFocus.current = true;
      settle(true, 0);
    },
    onBlur: (e: FocusEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      keyboardFocus.current = false;
      if (!hovered.current) settle(false, 0);
    },
  };

  return { open, props };
}
