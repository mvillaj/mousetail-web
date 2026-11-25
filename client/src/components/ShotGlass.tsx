import { useId } from 'react';
import { TASTE_LABELS } from '../lib/format';

/** "Balanced", "Leaning sour", or "Not tasted", for labels beside a cup. */
export function tasteLabel(taste: number | null | undefined) {
  return taste == null ? 'Not tasted' : (TASTE_LABELS[taste] ?? 'Not tasted');
}

/** How a shot's cup looks, seen from above, for one step of quality. */
type Pour = {
  /** The coffee's radial gradient, centre to edge. */
  coffee: [string, string, string];
  /** The crema's colour, also used for the glow and the flecks. */
  crema: string;
  /** Opacity of the two soft glows round the rim of the coffee. */
  glow: [number, number];
  flecks: number;
  /** The crema's shape, or none for a shot nobody tasted. */
  swirl?: string;
  /** A lighter sheen along the swirl's lower edge. */
  sheen?: { d: string; fill: string; opacity: number };
};

/** Three steps of quality, from how far the taste was off balanced. */
const POURS = {
  excellent: {
    coffee: ['#c87e30', '#b66d27', '#924a15'],
    crema: '#f5ac55',
    glow: [0.19, 0.17],
    flecks: 0.5,
    swirl:
      'M42 19 C64 10 88 28 88 50 C88 75 65 90 44 86 C24 82 20 65 28 51 C37 38 52 43 55 51 C43 47 42 61 50 66 C65 75 81 54 75 39 C70 27 55 23 42 19Z',
    sheen: {
      d: 'M37 67 C41 81 62 84 78 66 C72 84 51 91 38 81 Q33 75 37 67Z',
      fill: '#ffca77',
      opacity: 0.32,
    },
  },
  fair: {
    coffee: ['#a96020', '#945018', '#794016'],
    crema: '#e89b47',
    glow: [0.14, 0.12],
    flecks: 0.43,
    swirl:
      'M54 31 C78 27 91 48 78 67 C68 83 50 86 39 75 C34 70 38 69 42 72 C56 81 76 63 71 48 C68 39 61 34 54 31Z',
    sheen: {
      d: 'M42 72 C60 84 85 57 72 41 C86 55 75 79 55 81 Q45 80 42 72Z',
      fill: '#e8a55a',
      opacity: 0.19,
    },
  },
  bad: {
    coffee: ['#77451f', '#603414', '#512b14'],
    crema: '#a96129',
    glow: [0.09, 0.07],
    flecks: 0.36,
    swirl: 'M41 84 C57 88 74 77 81 61 C78 77 65 91 48 87 Q43 86 41 84Z',
    sheen: {
      d: 'M47 85 C61 85 73 77 81 61 C75 78 65 88 47 85Z',
      fill: '#e8a55a',
      opacity: 0.19,
    },
  },
  untasted: {
    coffee: ['#8f6c4b', '#7d5d40', '#674b33'],
    crema: '#b89874',
    glow: [0.1, 0.08],
    flecks: 0.3,
  },
} satisfies Record<string, Pour>;

export type Quality = keyof typeof POURS;

/**
 * Balanced is excellent, leaning either way is fair, and sour or bitter is bad.
 * An untasted shot gets a plain cup, so it never claims a taste nobody recorded.
 */
export function shotQuality(taste: number | null | undefined): Quality {
  if (taste == null) return 'untasted';
  const off = Math.abs(taste);
  return off === 0 ? 'excellent' : off === 1 ? 'fair' : 'bad';
}

/** Room round the cup for its saucer, in viewBox units. */
const SAUCER_PAD = 8;

/**
 * A shot as a cup seen from above: the coffee's colour and its crema show how
 * it tasted. With nothing poured yet (no yield) the cup is empty. On a coloured
 * card, a saucer seats the cup on the card instead of leaving it floating.
 */
export default function ShotGlass({
  yieldG,
  taste,
  width = 48,
  label,
  className,
  saucer = false,
}: {
  yieldG: number | null | undefined;
  taste?: number | null;
  width?: number;
  /** Accessible name; omit for a decorative cup beside text that says the same. */
  label?: string;
  className?: string;
  /** Seat the cup on a saucer tinted from the card's own ink. */
  saucer?: boolean;
}) {
  const id = useId();
  const quality = shotQuality(taste);
  const pour: Pour = POURS[quality];
  const poured = (yieldG ?? 0) > 0;
  const pad = saucer ? SAUCER_PAD : 0;
  const vbW = 116 + pad * 2;
  const vbH = 100 + pad * 2;

  return (
    <svg
      className={`shot-glass${saucer ? ' has-saucer' : ''}${className ? ` ${className}` : ''}`}
      data-quality={poured ? quality : 'empty'}
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      width={width}
      height={(width * vbH) / vbW}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}rim`} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#ddcdb7" />
          <stop offset=".48" stopColor="#f1e6d7" />
          <stop offset="1" stopColor="#d9c5ac" />
        </linearGradient>
        <radialGradient id={`${id}coffee`} cx=".46" cy=".4" r=".68">
          <stop stopColor={pour.coffee[0]} />
          <stop offset=".76" stopColor={pour.coffee[1]} />
          <stop offset="1" stopColor={pour.coffee[2]} />
        </radialGradient>
        <linearGradient id={`${id}crema`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={pour.crema} />
          <stop offset="1" stopColor={pour.crema} stopOpacity=".86" />
        </linearGradient>
      </defs>

      {saucer ? <circle className="saucer" cx="50" cy="50" r={50 + pad} /> : null}

      <g className="cup">
        <path
          className="handle"
          d="M93 40 H99 C115 40 115 62 98 64 L93 64"
          fill="none"
          stroke="#dfcdb6"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="48" fill={`url(#${id}rim)`} />

        {poured ? (
          <g className="liquid-group">
            <circle className="liquid" cx="50" cy="50" r="41.5" fill={`url(#${id}coffee)`} />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={pour.coffee[2]}
              strokeWidth="1.5"
              opacity=".28"
            />
            <path
              d="M12 52 C12 30 29 12 52 11 C74 10 88 29 89 49 C84 27 67 17 50 17 C32 17 18 32 12 52Z"
              fill={pour.crema}
              opacity={pour.glow[0]}
            />
            <path
              d="M20 68 C35 90 69 93 85 66 C76 88 41 98 20 68Z"
              fill={pour.crema}
              opacity={pour.glow[1]}
            />
            {pour.swirl ? (
              <path className="crema" d={pour.swirl} fill={`url(#${id}crema)`} />
            ) : null}
            {pour.sheen ? (
              <path d={pour.sheen.d} fill={pour.sheen.fill} opacity={pour.sheen.opacity} />
            ) : null}
            <g fill={pour.crema} opacity={pour.flecks}>
              <ellipse cx="32" cy="26" rx="5" ry="3.8" transform="rotate(-34 32 26)" />
              <ellipse cx="42" cy="20" rx="2.5" ry="1.9" transform="rotate(-20 42 20)" />
              <circle cx="48" cy="19" r="1.1" />
              <ellipse cx="23" cy="36" rx="2.4" ry="1.9" transform="rotate(-35 23 36)" />
              <circle cx="39" cy="34" r="1.7" />
              <circle cx="20" cy="43" r="1.1" />
            </g>
            <path d="M28 26 Q30 22 34 23 Q33 26 30 28Z" fill="#ffd08b" opacity=".23" />
          </g>
        ) : (
          <circle className="well" cx="50" cy="50" r="41.5" fill="#e7d8c4" />
        )}
      </g>
    </svg>
  );
}

/** The key to the cups, for a legend under a row of them. */
export function QualityLegend() {
  return (
    <>
      <span>
        <ShotGlass yieldG={1} taste={0} width={16} />
        Balanced
      </span>
      <span>
        <ShotGlass yieldG={1} taste={1} width={16} />
        Leaning sour or bitter
      </span>
      <span>
        <ShotGlass yieldG={1} taste={2} width={16} />
        Sour or bitter
      </span>
    </>
  );
}
