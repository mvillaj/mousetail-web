/**
 * The starting shot for a coffee, worked out by rules rather than by the model.
 *
 * Asking a model for the numbers gave a different curve every time for the same
 * bag. So the numbers come from here: the same coffee always gets the same
 * baseline, and the rules are written down where they can be read and tested.
 * The model is left two small nudges (`applyNudge`) for what the rules cannot
 * read, such as tasting notes, and the job of explaining the result.
 *
 * Anchored on Fellow's own Light, Medium and Dark Roast profiles: lighter and
 * denser wants hotter, longer and a longer ratio; darker and softer wants cooler,
 * shorter and stepped down from the peak so the back half does not turn bitter.
 */

import type { Es1Stage } from './es1.ts';
import type { Process, RoastLevel } from './types.ts';

export interface CoffeeTraits {
  roastLevel: RoastLevel | null;
  process: Process | null;
  altitudeMasl: number | null;
}

export type BaselineStage = Omit<Es1Stage, 'id'>;

export interface BaselineShot {
  brewTempF: number;
  doseG: number;
  ratio: number;
  stages: BaselineStage[];
  /** A few words for the curve, which the profile's name carries after the coffee's. */
  shape: string;
  /** What each rule did, in plain words. Handed to the model to explain from. */
  reasons: string[];
}

/** Every captured profile uses 18 g, and so does every suggestion. */
const DOSE_G = 18;

/** 201 °F is 93.9 °C, the hottest whole degree under the machine's 94 °C. */
const MAX_TEMP_F = 201;

/** Pre-infusion fill flow, unless the process calls for a gentler one. */
const FILL_FLOW = 4.5;

interface RoastRule {
  shape: string;
  tempF: number;
  ratio: number;
  /** Pre-infusion seconds at `preBar`; 0 for none. */
  preS: number;
  /** Whole bar: Fellow refuses a fractional pre-infusion hold. */
  preBar: number;
  /** Flat infusion steps, in order, as [seconds, bar]. */
  steps: [number, number][];
  /** A closing ramp as [seconds, end bar], or null. */
  ramp: [number, number] | null;
}

const ROAST: Record<RoastLevel, RoastRule> = {
  light: {
    shape: 'Long & hot',
    tempF: 201,
    ratio: 2.5,
    preS: 10,
    preBar: 3,
    steps: [[20, 9]],
    ramp: [6, 6],
  },
  'medium-light': {
    shape: 'Soft landing',
    tempF: 199,
    ratio: 2.3,
    preS: 8,
    preBar: 3,
    steps: [[22, 9]],
    ramp: [5, 6],
  },
  medium: {
    shape: 'Classic 9 bar',
    tempF: 198,
    ratio: 2.1,
    preS: 6,
    preBar: 3,
    steps: [[24, 9]],
    ramp: null,
  },
  'medium-dark': {
    shape: 'Stepped down',
    tempF: 196,
    ratio: 2.0,
    preS: 6,
    // Was 2.5, which Fellow refuses. 2 keeps it gentler than medium's 3.
    preBar: 2,
    steps: [
      [12, 8.5],
      [10, 7],
    ],
    ramp: null,
  },
  dark: {
    shape: 'Cool step-down',
    tempF: 194,
    ratio: 1.8,
    preS: 0,
    preBar: 0,
    steps: [
      [14, 8],
      [12, 6.5],
    ],
    ramp: null,
  },
};

/** Processes that drink fast and channel easily: wet the puck slower and longer. */
const FRAGILE: Process[] = ['natural', 'anaerobic', 'experimental'];

/** At or above this the beans are dense enough to take more heat. */
const DENSE_MASL = 1800;
/** At or below this they are soft enough to want less. */
const SOFT_MASL = 1200;

export function baselineFor(c: CoffeeTraits): BaselineShot {
  const roast = c.roastLevel ?? 'medium';
  const rule = ROAST[roast];
  const reasons = [
    c.roastLevel
      ? `${roast} roast: ${rule.tempF} °F at 1:${rule.ratio.toFixed(1)}, the shape for that roast.`
      : `Roast level unknown, so it starts from the medium shape: ${rule.tempF} °F at 1:${rule.ratio.toFixed(1)}.`,
  ];

  let tempF = rule.tempF;
  let preS = rule.preS;
  let preBar = rule.preBar;
  let fillFlow = FILL_FLOW;

  if (c.process && FRAGILE.includes(c.process)) {
    tempF -= 1;
    // A dark roast has no pre-infusion to lengthen, so it gets a short one.
    preS = preS ? preS + 2 : 4;
    preBar = preBar || 2;
    fillFlow = 3.5;
    reasons.push(
      `${c.process} process: 1 °F cooler, and a longer, slower pre-infusion so a fast-drinking puck wets evenly.`,
    );
  }

  if (c.altitudeMasl != null && c.altitudeMasl >= DENSE_MASL) {
    tempF += 1;
    if (preS) preS += 2;
    reasons.push(
      `Grown at ${c.altitudeMasl} masl, so dense: 1 °F hotter and a longer pre-infusion.`,
    );
  } else if (c.altitudeMasl != null && c.altitudeMasl <= SOFT_MASL) {
    tempF -= 1;
    reasons.push(`Grown at ${c.altitudeMasl} masl, so soft: 1 °F cooler.`);
  }

  const stages: BaselineStage[] = [];
  if (preS) {
    stages.push({
      kind: 'preinfusion',
      label: 'Pre-infusion',
      durationS: preS,
      pressureBar: preBar,
      endPressureBar: preBar,
      flowLimitMlS: fillFlow,
    });
  }
  rule.steps.forEach(([durationS, bar], i) => {
    stages.push({
      kind: 'infusion',
      label: i === 0 ? 'Infusion' : 'Step down',
      durationS,
      pressureBar: bar,
      endPressureBar: bar,
      flowLimitMlS: FILL_FLOW,
    });
  });
  if (rule.ramp) {
    const from = rule.steps.at(-1)![1];
    stages.push({
      kind: 'rampdown',
      label: 'Ramp down',
      durationS: rule.ramp[0],
      pressureBar: from,
      endPressureBar: rule.ramp[1],
      flowLimitMlS: FILL_FLOW,
    });
  }

  return {
    brewTempF: Math.min(MAX_TEMP_F, tempF),
    doseG: DOSE_G,
    ratio: rule.ratio,
    stages,
    shape: rule.shape,
    reasons,
  };
}

/** How far the model may move the baseline, either way. */
export const NUDGE_LIMITS = { tempF: 2, ratio: 0.2 } as const;

export interface Nudge {
  tempF: number;
  ratio: number;
}

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/**
 * Apply the model's nudge, held to its limits and rounded to what the machine
 * shows: whole degrees F and tenths of a ratio. Whatever the model sends, the
 * result stays within reach of the baseline and under the temperature ceiling.
 */
export function applyNudge(base: BaselineShot, nudge: Nudge): BaselineShot {
  const tempF = Math.round(base.brewTempF + clamp(nudge.tempF || 0, NUDGE_LIMITS.tempF));
  const ratio = Math.round((base.ratio + clamp(nudge.ratio || 0, NUDGE_LIMITS.ratio)) * 10) / 10;
  return { ...base, brewTempF: Math.min(MAX_TEMP_F, tempF), ratio };
}
