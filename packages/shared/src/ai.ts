/**
 * Shapes for the two model-backed features.
 *
 * These are deliberately *not* the storage schemas. `coffeeInputSchema` and
 * `es1ProfileSchema` carry defaults, unions, refinements and `.strict()`, none of
 * which express cleanly as JSON Schema. So generation is shaped by the simple
 * schemas below, and the result is then validated by the real ones before it is
 * allowed anywhere near the database or the machine.
 *
 * That two-step is the safety property worth keeping: a model that invents a
 * 15-bar stage or a 300-second shot fails `es1ProfileSchema` and never reaches
 * the editor, let alone the ES1.
 */

import { z } from 'zod';
import type { Es1Profile } from './es1.ts';
import { applyNudge, type BaselineShot } from './baseline.ts';
import { fToC } from './temp.ts';

export const PROCESS_VALUES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'experimental',
  'other',
] as const;

export const ROAST_VALUES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;

/** What we can usually read off a roaster's bag copy. Everything but the two
 *  headline fields is nullable, because plenty of bags simply don't say. */
export const coffeeExtractionSchema = z.object({
  name: z.string(),
  roaster: z.string(),
  origin: z.string().nullable(),
  region: z.string().nullable(),
  producer: z.string().nullable(),
  varietal: z.string().nullable(),
  process: z.enum(PROCESS_VALUES).nullable(),
  roastLevel: z.enum(ROAST_VALUES).nullable(),
  altitudeMasl: z.number().nullable(),
  tastingNotes: z.array(z.string()),
  /** Fields the text did not cover, so the UI can say so rather than imply certainty. */
  notFound: z.array(z.string()),
  /**
   * Fields filled from world knowledge rather than the text -- resolving "San
   * Adolfo" to Colombia, say. Useful, but the user is told which fields those
   * were so they can check rather than discover it later.
   */
  derived: z.array(z.string()),
});

export type CoffeeExtraction = z.infer<typeof coffeeExtractionSchema>;

/**
 * What the model returns for a suggested profile. It does not design the shot:
 * `baselineFor` does that by rule, so the same coffee always gets the same curve.
 * The model may nudge temperature and ratio within `NUDGE_LIMITS` for what the
 * rules cannot read, and explains the result. There is no name either: code
 * builds it from the coffee and the curve's shape (`profileNameFor`).
 */
export const profileSuggestionSchema = z.object({
  description: z.string(),
  /** Whole degrees Fahrenheit added to the baseline, the way the machine shows them. */
  tempNudgeF: z.number(),
  ratioNudge: z.number(),
  /** Why this shape, in the user's terms. Shown above the curve. */
  rationale: z.string(),
});

export type ProfileSuggestion = z.infer<typeof profileSuggestionSchema>;

export interface AiStatus {
  enabled: boolean;
  /** Shown next to the disabled controls so the reason is never a mystery. */
  reason?: string;
}

/**
 * Turn the baseline and the model's nudge into a real profile. Kept pure and here
 * rather than in the route so the properties that matter -- the same coffee gives
 * the same curve, and no nudge can push it past the machine -- are testable
 * without a model or an API key.
 */
export function suggestionToProfile(
  base: BaselineShot,
  s: ProfileSuggestion,
  coffeeName: string,
  stageId: (i: number) => string,
): Es1Profile {
  const shot = applyNudge(base, { tempF: s.tempNudgeF, ratio: s.ratioNudge });
  return {
    id: 'suggested',
    name: profileNameFor(coffeeName, base.shape),
    description: s.description,
    doseG: shot.doseG,
    ratio: shot.ratio,
    // The one conversion. A whole degree F rarely lands on a clean degree C,
    // which is exactly what real captured profiles look like (93.88, not 94).
    brewTempC: fToC(shot.brewTempF),
    stages: shot.stages.map((st, i) => ({ ...st, id: stageId(i) })),
  };
}

/** Profile names stop at 50 characters, coffee names at 120. */
const PROFILE_NAME_MAX = 50;

/**
 * A suggested profile is named for its coffee and the shape of its curve, as in
 * "Hi-Fi Espresso · Stepped down": findable by the bag, and telling one curve
 * from another at a glance. A long coffee name is cut to fit; the shape stays.
 */
export function profileNameFor(coffeeName: string, shape: string): string {
  const suffix = ` · ${shape}`;
  const room = PROFILE_NAME_MAX - suffix.length;
  const name = coffeeName.trim().replace(/\s+/g, ' ');
  const fitted = name.length <= room ? name : `${name.slice(0, room - 1).trimEnd()}…`;
  return fitted + suffix;
}

/**
 * Is the pasted box a bare link rather than copy? Shared because the server needs
 * it to decide whether to fetch a page, and the form needs it to know whether the
 * paste doubles as the coffee's Link.
 */
export function asUrl(input: string): string | null {
  const trimmed = input.trim();
  if (/\s/.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}
