import type { ReactNode } from 'react';
import type { Transition, Variants } from 'motion/react';
import * as m from 'motion/react-m';

/**
 * The sidebar's icons, each with a small move it makes while its link is
 * hovered or focused. The idea is animate-ui's Lucide icons; the drawing is
 * lucide's own (same paths, 24px grid, 2px round strokes), so at rest they
 * match the rest of the app's lucide icons exactly.
 *
 * Built on `m.*` rather than animate-ui's package: that imports the full
 * `motion` component, which LazyMotion's strict mode (main.tsx) refuses.
 *
 * The link decides when: it passes `animate`, and the svg sets its children's
 * variant to 'hover' or 'rest'. Moves that are keyframes play once on the way
 * in; the rest return when the pointer leaves. MotionConfig's
 * reducedMotion="user" keeps them all still for anyone who asked for that.
 */
export interface NavIconProps {
  /** Play the hover move: the link is hovered or focused. */
  animate: boolean;
  className?: string;
}
export type NavIcon = (props: NavIconProps) => ReactNode;

function Svg({ animate, className, children }: NavIconProps & { children: ReactNode }) {
  return (
    <m.svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // A wobble may lean a stroke past the box; let it.
      overflow="visible"
      className={className}
      aria-hidden="true"
      data-animating={animate || undefined}
      initial={false}
      animate={animate ? 'hover' : 'rest'}
    >
      {children}
    </m.svg>
  );
}

const quick: Transition = { duration: 0.45, ease: 'easeInOut' };
const spring: Transition = { type: 'spring', stiffness: 260, damping: 14 };

type Keyframes = Record<string, number[]>;

/**
 * One-shot keyframes on the way in, a quick settle on the way out. Each move
 * starts and ends at rest, so rest is just every move's first frame.
 */
function wiggle(hover: Keyframes, transition: Transition = quick): Variants {
  const rest = Object.fromEntries(Object.entries(hover).map(([k, frames]) => [k, frames[0]]));
  return { rest, hover: { ...hover, transition } };
}

// Dashboard: the tiles pop in turn, around the grid.
const tile = (i: number): Variants =>
  wiggle({ scale: [1, 0.7, 1] }, { ...quick, duration: 0.35, delay: i * 0.06 });
export const LayoutGrid: NavIcon = (p) => (
  <Svg {...p}>
    <m.rect variants={tile(0)} width="7" height="7" x="3" y="3" rx="1" />
    <m.rect variants={tile(1)} width="7" height="7" x="14" y="3" rx="1" />
    <m.rect variants={tile(2)} width="7" height="7" x="14" y="14" rx="1" />
    <m.rect variants={tile(3)} width="7" height="7" x="3" y="14" rx="1" />
  </Svg>
);

// Shot log: the clock winds back.
export const History: NavIcon = (p) => (
  <Svg {...p}>
    <m.g variants={wiggle({ rotate: [0, -360] }, { duration: 0.7, ease: 'easeInOut' })}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </m.g>
    <m.path
      variants={wiggle({ rotate: [0, -360] }, { duration: 0.7, ease: 'easeInOut' })}
      style={{ originX: '12px', originY: '12px', transformBox: 'view-box' }}
      d="M12 7v5l4 2"
    />
  </Svg>
);

// Profiles: a ripple runs down the lines.
const wave = (i: number): Variants => wiggle({ x: [0, -2, 2, 0] }, { ...quick, delay: i * 0.08 });
export const Waves: NavIcon = (p) => (
  <Svg {...p}>
    <m.path variants={wave(0)} d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />
    <m.path variants={wave(1)} d="M2 12q2.5 2 5 0t5 0 5 0 5 0" />
    <m.path variants={wave(2)} d="M2 19q2.5 2 5 0t5 0 5 0 5 0" />
  </Svg>
);

// Machines: steam rises off the cup.
const steam = (i: number): Variants =>
  wiggle(
    { y: [0, -2, 0], opacity: [1, 0.2, 1] },
    { duration: 0.6, ease: 'easeInOut', delay: i * 0.1 },
  );
export const Coffee: NavIcon = (p) => (
  <Svg {...p}>
    <m.path variants={steam(0)} d="M6 2v2" />
    <m.path variants={steam(1)} d="M10 2v2" />
    <m.path variants={steam(2)} d="M14 2v2" />
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
  </Svg>
);

// Grinders: the burr turns.
export const Cog: NavIcon = (p) => (
  <Svg {...p}>
    <m.g variants={{ rest: { rotate: 0 }, hover: { rotate: 90, transition: spring } }}>
      <path d="M11 10.27 7 3.34" />
      <path d="m11 13.73-4 6.93" />
      <path d="M12 22v-2" />
      <path d="M12 2v2" />
      <path d="M14 12h8" />
      <path d="m17 20.66-1-1.73" />
      <path d="m17 3.34-1 1.73" />
      <path d="M2 12h2" />
      <path d="m20.66 17-1.73-1" />
      <path d="m20.66 7-1.73 1" />
      <path d="m3.34 17 1.73-1" />
      <path d="m3.34 7 1.73 1" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="8" />
    </m.g>
  </Svg>
);

// My coffees: the bean rocks.
export const Bean: NavIcon = (p) => (
  <Svg {...p}>
    <m.g variants={wiggle({ rotate: [0, -14, 10, -4, 0] }, { duration: 0.6, ease: 'easeInOut' })}>
      <path d="M10.165 6.598C9.954 7.478 9.64 8.36 9 9c-.64.64-1.521.954-2.402 1.165A6 6 0 0 0 8 22c7.732 0 14-6.268 14-14a6 6 0 0 0-11.835-1.402Z" />
      <path d="M5.341 10.62a4 4 0 1 0 5.279-5.28" />
    </m.g>
  </Svg>
);

// Explore: the needle swings and settles.
export const Compass: NavIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <m.path
      variants={wiggle({ rotate: [0, 70, -25, 10, 0] }, { duration: 0.8, ease: 'easeInOut' })}
      d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
    />
  </Svg>
);

// My account: a nod.
export const UserRound: NavIcon = (p) => (
  <Svg {...p}>
    <m.circle variants={wiggle({ y: [0, 1.5, -1, 0] })} cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </Svg>
);

// Fellow account: the cog under the cloud turns.
export const CloudCog: NavIcon = (p) => (
  <Svg {...p}>
    <m.g variants={{ rest: { rotate: 0 }, hover: { rotate: 120, transition: spring } }}>
      <path d="m10.852 19.772-.383.924" />
      <path d="m13.148 14.228.383-.923" />
      <path d="M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923" />
      <path d="m13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544" />
      <path d="m14.772 15.852.923-.383" />
      <path d="m14.772 18.148.923.383" />
      <path d="m9.228 15.852-.923-.383" />
      <path d="m9.228 18.148-.923.383" />
    </m.g>
    <path d="M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2" />
  </Svg>
);

// Getting started: the leaves lift.
const leaf = (rotate: number, delay: number): Variants =>
  wiggle(
    { rotate: [0, rotate, 0], scale: [1, 1.12, 1] },
    { duration: 0.55, ease: 'easeInOut', delay },
  );
export const Sprout: NavIcon = (p) => (
  <Svg {...p}>
    <m.path
      variants={leaf(-10, 0.08)}
      style={{ originX: 0, originY: 1 }}
      d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"
    />
    <m.path
      variants={leaf(10, 0)}
      style={{ originX: 1, originY: 1 }}
      d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"
    />
    <path d="M5 21h14" />
  </Svg>
);

// Changelog: the book opens wider.
export const BookOpen: NavIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v16" />
    <m.path
      variants={wiggle({ scaleY: [1, 0.88, 1] }, { duration: 0.45, ease: 'easeInOut' })}
      style={{ originY: 1 }}
      d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"
    />
  </Svg>
);
