/**
 * Motion's animation engine, loaded on its own after first paint (see
 * LazyMotion in main.tsx), so it never weighs on the app's first load.
 * domMax rather than domAnimation: coffees glide between groups on the shelf
 * with a layout animation, which only domMax includes.
 */
export { domMax as default } from 'motion/react';
