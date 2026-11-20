/**
 * Motion's animation engine, loaded on its own after first paint (see
 * LazyMotion in main.tsx), so it never weighs on the app's first load.
 * domMax rather than domAnimation: the nav highlight glides between links
 * with a layout animation, which only domMax includes.
 */
export { domMax as default } from 'motion/react';
