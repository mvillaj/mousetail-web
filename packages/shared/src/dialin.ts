/**
 * Dial-in heuristics.
 *
 * This is not science. It is the mental checklist a barista runs after tasting
 * a shot, written down: judge the flow rate against the target window, then let
 * taste break the tie. Its only job is to suggest the next single change, since
 * changing two things at once teaches you nothing.
 */

export interface ShotLike {
  doseG: number;
  yieldG: number;
  shotTimeS: number;
  preInfusionS?: number | null;
  tasteBalance?: number | null; // -2 sour … 0 balanced … +2 bitter
  rating?: number | null;
}

export type SuggestionDirection = 'finer' | 'coarser' | 'hold' | 'more-yield' | 'less-yield';

export interface Suggestion {
  direction: SuggestionDirection;
  /** Suggested move in native grinder units, when the direction is a grind change. */
  steps: number;
  headline: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

/** A coffee counts as dialed in once this many shots have each rated at least this well. */
export const DIALED_IN_MIN_SHOTS = 3;
export const DIALED_IN_MIN_RATING = 4;

export const isDialedIn = (wellRatedShots: number | null | undefined) =>
  (wellRatedShots ?? 0) >= DIALED_IN_MIN_SHOTS;

export const ratioOf = (s: ShotLike) => s.yieldG / s.doseG;
/** Grams of liquid per second, excluding pre-infusion. */
export const flowRate = (s: ShotLike) =>
  s.yieldG / Math.max(1, s.shotTimeS - (s.preInfusionS ?? 0));

export function suggestNextShot(s: ShotLike, targetTimeS = 28): Suggestion {
  const ratio = ratioOf(s);
  const t = s.shotTimeS;
  const fast = t < targetTimeS - 5;
  const slow = t > targetTimeS + 5;
  const taste = s.tasteBalance ?? null;

  if (fast && taste !== null && taste <= -1) {
    return {
      direction: 'finer',
      steps: 2,
      headline: 'Go finer — 2 steps',
      reason: `${t}s at 1:${ratio.toFixed(1)} is running fast and it tasted sour. Both point the same way: under-extracted.`,
      confidence: 'high',
    };
  }
  if (slow && taste !== null && taste >= 1) {
    return {
      direction: 'coarser',
      steps: 2,
      headline: 'Go coarser — 2 steps',
      reason: `${t}s is slow and the cup read bitter. You are pulling past the sweet spot.`,
      confidence: 'high',
    };
  }
  if (fast) {
    return {
      direction: 'finer',
      steps: 1,
      headline: 'Go finer — 1 step',
      reason: `${t}s is ${targetTimeS - t}s short of your ${targetTimeS}s target. Tighten the grind before touching anything else.`,
      confidence: 'medium',
    };
  }
  if (slow) {
    return {
      direction: 'coarser',
      steps: 1,
      headline: 'Go coarser — 1 step',
      reason: `${t}s is ${t - targetTimeS}s long. Open the grind up a step.`,
      confidence: 'medium',
    };
  }
  if (taste !== null && taste <= -1) {
    return {
      direction: 'more-yield',
      steps: 0,
      headline: `Pull longer — try 1:${(ratio + 0.3).toFixed(1)}`,
      reason: 'Time is on target but it tasted sour. Extend the yield before changing the grind.',
      confidence: 'medium',
    };
  }
  if (taste !== null && taste >= 1) {
    return {
      direction: 'less-yield',
      steps: 0,
      headline: `Cut it shorter — try 1:${Math.max(1, ratio - 0.3).toFixed(1)}`,
      reason: 'Time is on target but it tasted bitter. Stop the shot earlier.',
      confidence: 'medium',
    };
  }
  return {
    direction: 'hold',
    steps: 0,
    headline: 'Hold this setting',
    reason: `${t}s at 1:${ratio.toFixed(1)} is inside the window. Pull it again and see if it repeats.`,
    confidence: taste === null ? 'low' : 'high',
  };
}
