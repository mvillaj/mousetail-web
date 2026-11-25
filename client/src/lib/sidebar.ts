import { useEffect, useState } from 'react';

const KEY = 'brewlab.sidebar';

/** The slide's length and the drop's fall after it, and then some: see `slide` below. */
export const SLIDE_OVER_MS = 900;

/**
 * Whether the desktop sidebar starts open: as it was left on this device, and
 * until then open, with its labels, rather than a rail of icons to learn.
 */
export function sidebarStartsOpen(): boolean {
  try {
    const left = localStorage.getItem(KEY);
    if (left) return left === 'open';
  } catch {
    // Private mode: nothing is remembered.
  }
  return true;
}

interface Slide {
  /** How far through itself it starts: 0, unless it turns another one back. */
  from: number;
  /** Whether it runs on the reverse of the usual curve, to meet that one. */
  turned: boolean;
}

/** How far through its slide the sidebar is (0 to 1), or null when it's still. */
export function slideProgress(sidebar: HTMLElement | null): number | null {
  const slide = sidebar
    ?.getAnimations?.()
    .find((a) => /^rail-(open|close)$/.test((a as CSSAnimation).animationName));
  return slide?.effect?.getComputedTiming().progress ?? null;
}

/**
 * The desktop sidebar, open or a rail of icons, as it was left. `slide` is set
 * while it moves between the two, so the stylesheet animates a toggle and
 * nothing else: not the first paint, nor a link or a breakpoint arriving later.
 */
export function useSidebar() {
  const [open, setOpen] = useState(sidebarStartsOpen);
  const [slide, setSlide] = useState<Slide | null>(null);

  // A clock, not animationend: under reduced motion there's nothing to end.
  useEffect(() => {
    if (!slide) return;
    const over = setTimeout(() => setSlide(null), SLIDE_OVER_MS);
    return () => clearTimeout(over);
  }, [slide]);

  /** `progress` is how far through a slide it already is (slideProgress). */
  function toggle(progress: number | null) {
    const next = !open;
    setOpen(next);
    // Mid-slide, it turns back from where it is: what's done is what's left,
    // on the curve run backwards.
    setSlide((was) =>
      progress === null ? { from: 0, turned: false } : { from: 1 - progress, turned: !was?.turned },
    );
    try {
      localStorage.setItem(KEY, next ? 'open' : 'rail');
    } catch {
      // Private mode: the choice lasts until the app closes.
    }
  }

  return { open, slide, toggle };
}
