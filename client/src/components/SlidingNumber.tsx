import * as m from 'motion/react-m';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number whose digits roll to their new value, like a dial, when it
 * changes. Display only (aria-hidden): whatever it shows should also be in
 * the page as text, as the grind dial's input is.
 *
 * Each digit is keyed by its place (units, tens, tenths…), so going from 9 to
 * 10 rolls the units and adds a tens digit, rather than every digit shuffling
 * one place over. Anything that isn't a digit (a point, a minus) just sits
 * there. It doesn't animate on first render.
 */
export function SlidingNumber({ value, className }: { value: string; className?: string }) {
  const [whole, fraction] = value.split('.', 2) as [string, string | undefined];
  const places = [
    ...[...whole].map((ch, i) => ({ ch, key: `w${whole.length - 1 - i}` })),
    ...(fraction === undefined
      ? []
      : [{ ch: '.', key: 'point' }, ...[...fraction].map((ch, i) => ({ ch, key: `f${i}` }))]),
  ];

  return (
    <span className={`sliding-number${className ? ` ${className}` : ''}`} aria-hidden="true">
      {places.map(({ ch, key }) =>
        /\d/.test(ch) ? (
          <span key={key} className="sliding-digit" data-digit={ch}>
            <m.span
              className="sliding-reel"
              initial={false}
              animate={{ y: `${-Number(ch) * 10}%` }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </m.span>
          </span>
        ) : (
          <span key={key}>{ch}</span>
        ),
      )}
    </span>
  );
}
