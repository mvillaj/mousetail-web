import { useEffect, useState, type RefObject } from 'react';

/**
 * Names the rail's icon under keyboard focus. A title tooltip only ever comes
 * to a pointer. It's drawn beside the rail rather than in the row because the
 * nav scrolls, and would cut it off. Sight only: every row is already named.
 */
export default function RailLabel({ sidebar }: { sidebar: RefObject<HTMLElement | null> }) {
  const [label, setLabel] = useState<{ text: string; top: number } | null>(null);

  useEffect(() => {
    const el = sidebar.current;
    if (!el) return;
    let on: HTMLElement | null = null;
    const place = () => {
      if (!on) return setLabel(null);
      const row = on.getBoundingClientRect();
      setLabel({
        text: on.title,
        top: row.top + row.height / 2 - el.getBoundingClientRect().top,
      });
    };
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // The popover's controls are labelled where they are.
      const named = target.title && !target.closest('.settings-pop');
      on = named && target.matches(':focus-visible') ? target : null;
      place();
    };
    const drop = () => {
      on = null;
      place();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && drop();

    el.addEventListener('focusin', onFocus);
    el.addEventListener('focusout', drop);
    el.addEventListener('keydown', onKey);
    // Focus can scroll the nav; scroll doesn't bubble, so it's caught going down.
    el.addEventListener('scroll', place, { capture: true, passive: true });
    return () => {
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('focusout', drop);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('scroll', place, { capture: true });
    };
  }, [sidebar]);

  if (!label) return null;
  return (
    <div className="rail-label" aria-hidden="true" style={{ top: label.top }}>
      {label.text}
    </div>
  );
}
