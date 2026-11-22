import { useEffect, useState, type RefObject } from 'react';

/** How long after the last movement a scroller still counts as scrolling. */
export const SCROLLING_MS = 800;

/**
 * Whether someone is scrolling a scroller, or was a moment ago. A scroll that
 * ends where the page itself just put it (`placedAt`) isn't anyone's.
 */
export function useScrolling(
  ref: RefObject<HTMLElement | null>,
  placedAt: RefObject<number | null>,
) {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let still: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const placed = placedAt.current === el.scrollTop;
      placedAt.current = null;
      if (placed) return;
      setScrolling(true);
      clearTimeout(still);
      still = setTimeout(() => setScrolling(false), SCROLLING_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(still);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ref, placedAt]);

  return scrolling;
}
