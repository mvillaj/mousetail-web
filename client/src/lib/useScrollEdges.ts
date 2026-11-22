import { useLayoutEffect, useState, type RefObject } from 'react';

/** How much a scroller may be short of an edge and still count as at it. */
const SLACK_PX = 2;

/**
 * Whether a scroller has more to show above or below what's in view, kept up
 * as it's scrolled, as it's resized, and as what's in it changes size.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ above: false, below: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const above = el.scrollTop > SLACK_PX;
      const below = el.scrollHeight - el.clientHeight - el.scrollTop > SLACK_PX;
      setEdges((was) => (was.above === above && was.below === below ? was : { above, below }));
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const sized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    sized?.observe(el);
    for (const child of el.children) sized?.observe(child);
    // Rows coming or going (a machine changes which links there are).
    const changed = new MutationObserver(read);
    changed.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', read);
      sized?.disconnect();
      changed.disconnect();
    };
  }, [ref]);

  return edges;
}
