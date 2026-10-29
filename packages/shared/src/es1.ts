/**
 * The Fellow Espresso Series 1 profile model.
 *
 * The ES1 builds a shot out of ordered, timed phases. Each phase targets a
 * pressure; the machine modulates flow to hit it, with an optional flow ceiling.
 * A phase whose end pressure differs from its start pressure ramps linearly —
 * that is how the stock "Lever" profile descends 9 → 4 bar over six stages.
 *
 * Ranges below come from Fellow's published figures where they exist
 * (temperature 50-94 °C, pump calibrated to 9 bar of extraction) and from the
 * stock profiles where they do not. Anything inferred is marked in RANGE_NOTES.
 */

export const ES1_LIMITS = {
  /** Confirmed: no captured profile exceeds 94. 93.88 appears once -- the machine
   *  displays Fahrenheit (tempUnit: "f"), so values are not always clean 0.5 steps. */
  tempC: { min: 50, max: 94, step: 0.01 },
  pressureBar: { min: 1, max: 9, step: 0.1 },
  stageDurationS: { min: 1, max: 60, step: 1 },
  totalDurationS: { max: 180 },
  doseG: { min: 5, max: 25, step: 0.1 },
  ratio: { min: 1, max: 4, step: 0.1 },
  stages: { min: 1, max: 12 },
  /**
   * Flow is only settable on pre-infusion (`preInfusionFillFlowRate` on the wire);
   * infusion and ramp-down steps carry no flow field. Range confirmed from the
   * app UI, replacing the earlier guess of 0.5-8 inferred from stock profiles.
   */
  flowMlS: { min: 1, max: 6.5, step: 0.1 },
  /** Pre-infusion runs far longer than an infusion step. Confirmed from the app UI. */
  preInfusion: {
    durationS: { min: 1, max: 120, step: 1 },
    /**
     * Whole bar only. Confirmed by a refused push, 2026-10-29: Fellow answered
     * 400 "preInfusionHoldPressure must be an integer number" to 2.5.
     */
    holdPressureBar: { min: 1, max: 9, step: 1 },
    fillFlowMlS: { min: 1, max: 6.5, step: 0.1 },
  },
} as const;

export const RANGE_NOTES: Record<string, string> = {
  tempC: 'Published by Fellow: 122-201 degF (50-94 degC). Captured profiles top out at 201 degF.',
  pressureBar:
    'Captured infusion and pre-infusion pressures span 3-9 bar; the app caps pre-infusion at 1-9.',
  stageDurationS: 'Not published. Longest captured infusion step is 30 s.',
  doseG: 'Not published. Every captured profile uses an 18 g dose.',
  preInfusion: 'Confirmed from the app UI: 1-120 s, 1-9 bar in whole bar, 1-6.5 ml/s in 0.1 steps.',
  grindSize:
    'Unknown scale. Captured values run 0 to 2 in tenths; every factory profile is 0, which suggests a relative offset rather than an absolute setting.',
};

export type StageKind = 'preinfusion' | 'infusion' | 'rampdown';

export interface Es1Stage {
  id: string;
  kind: StageKind;
  label?: string;
  durationS: number;
  /** Pressure at the start of the phase, in bar. */
  pressureBar: number;
  /** Pressure at the end of the phase. Equal to pressureBar for a flat stage. */
  endPressureBar: number;
  /** Ceiling the machine will not exceed while chasing the pressure target. */
  flowLimitMlS: number;
}

export interface Es1Profile {
  id: string;
  name: string;
  description?: string;
  doseG: number;
  /** Yield expressed as a ratio: 2 means 1:2, i.e. 18 g in → 36 g out. */
  ratio: number;
  brewTempC: number;
  /**
   * Grind setting stored with the profile, on the machine's own scale.
   * Captured from the Fellow app as `grindSize: 2`; the scale's bounds and units
   * are not yet known, so this is carried through untouched rather than
   * normalised against the grinder registry.
   */
  grindSize?: number;
  stages: Es1Stage[];
}

export function totalDurationS(p: Pick<Es1Profile, 'stages'>): number {
  return p.stages.reduce((sum, s) => sum + s.durationS, 0);
}

export function yieldG(p: Pick<Es1Profile, 'doseG' | 'ratio'>): number {
  return Math.round(p.doseG * p.ratio * 10) / 10;
}

/** Sample the pressure curve at 0.5 s resolution for charting. */
export function pressureCurve(p: Pick<Es1Profile, 'stages'>, resolutionS = 0.5) {
  const points: { t: number; bar: number; flow: number; stage: string }[] = [];
  let t = 0;
  for (const stage of p.stages) {
    const steps = Math.max(1, Math.round(stage.durationS / resolutionS));
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      points.push({
        t: Math.round((t + frac * stage.durationS) * 10) / 10,
        bar:
          Math.round(
            (stage.pressureBar + (stage.endPressureBar - stage.pressureBar) * frac) * 100,
          ) / 100,
        flow: stage.flowLimitMlS,
        stage: stage.label ?? stage.kind,
      });
    }
    t += stage.durationS;
  }
  return points;
}

let stageCounter = 0;
export function makeStage(kind: StageKind, overrides: Partial<Es1Stage> = {}): Es1Stage {
  const defaults: Record<StageKind, Omit<Es1Stage, 'id' | 'kind'>> = {
    preinfusion: { durationS: 5, pressureBar: 3, endPressureBar: 3, flowLimitMlS: 4.5 },
    infusion: { durationS: 22, pressureBar: 9, endPressureBar: 9, flowLimitMlS: 4.5 },
    rampdown: { durationS: 5, pressureBar: 9, endPressureBar: 3, flowLimitMlS: 4.5 },
  };
  return {
    id: `st_${Date.now().toString(36)}_${(stageCounter++).toString(36)}`,
    kind,
    ...defaults[kind],
    ...overrides,
  };
}

/**
 * Fellow's factory profiles, transcribed from the published defaults. They make
 * good seed data and good regression fixtures for the profile editor.
 */
export const STOCK_PROFILES: Omit<Es1Profile, 'id'>[] = [
  {
    name: 'Light Roast',
    description: 'Hot and long. Fellow’s default for light, dense, high-acidity coffees.',
    doseG: 18,
    ratio: 2.5,
    brewTempC: 94,
    stages: [
      {
        id: 's1',
        kind: 'preinfusion',
        label: 'Pre-infusion',
        durationS: 5,
        pressureBar: 3,
        endPressureBar: 3,
        flowLimitMlS: 4.5,
      },
      {
        id: 's2',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 20,
        pressureBar: 9,
        endPressureBar: 9,
        flowLimitMlS: 4.5,
      },
      {
        id: 's3',
        kind: 'rampdown',
        label: 'Ramp down',
        durationS: 5,
        pressureBar: 9,
        endPressureBar: 3,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Medium Roast',
    description: 'The middle of the road. A safe first pull on an unfamiliar bag.',
    doseG: 18,
    ratio: 2,
    brewTempC: 92,
    stages: [
      {
        id: 's1',
        kind: 'preinfusion',
        label: 'Pre-infusion',
        durationS: 5,
        pressureBar: 3,
        endPressureBar: 3,
        flowLimitMlS: 4.5,
      },
      {
        id: 's2',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 25,
        pressureBar: 9,
        endPressureBar: 9,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Dark Roast',
    description:
      'Cooler and shorter, with no pre-infusion, to keep dark roasts out of ashtray territory.',
    doseG: 18,
    ratio: 1.5,
    brewTempC: 90,
    stages: [
      {
        id: 's1',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 27,
        pressureBar: 8,
        endPressureBar: 8,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Modern Arc',
    description: 'Long, gentle pre-infusion into a full-pressure body, then a soft landing.',
    doseG: 18,
    ratio: 2,
    brewTempC: 92.5,
    stages: [
      {
        id: 's1',
        kind: 'preinfusion',
        label: 'Pre-infusion',
        durationS: 10,
        pressureBar: 3,
        endPressureBar: 3,
        flowLimitMlS: 4.5,
      },
      {
        id: 's2',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 20,
        pressureBar: 9,
        endPressureBar: 9,
        flowLimitMlS: 4.5,
      },
      // Corrected against the captured factory profile (6_modernarc): the tail
      // lands at 6 bar, not 3. Light Roast is the one that descends to 3.
      {
        id: 's3',
        kind: 'rampdown',
        label: 'Ramp down',
        durationS: 5,
        pressureBar: 9,
        endPressureBar: 6,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Classic 9 Bar',
    description: 'One flat stage at nine bar. The Italian benchmark.',
    doseG: 18,
    ratio: 2,
    brewTempC: 93,
    stages: [
      {
        id: 's1',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 28,
        pressureBar: 9,
        endPressureBar: 9,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Lever',
    description: 'Six descending stages from 9 to 4 bar — a spring-lever decline, digitally.',
    doseG: 18,
    ratio: 2.5,
    brewTempC: 94,
    stages: [
      {
        id: 's1',
        kind: 'preinfusion',
        label: 'Pre-infusion',
        durationS: 10,
        pressureBar: 3,
        endPressureBar: 3,
        flowLimitMlS: 3,
      },
      {
        id: 's2',
        kind: 'infusion',
        label: 'Decline 1',
        durationS: 5,
        pressureBar: 9,
        endPressureBar: 9,
        flowLimitMlS: 4.5,
      },
      {
        id: 's3',
        kind: 'infusion',
        label: 'Decline 2',
        durationS: 5,
        pressureBar: 8,
        endPressureBar: 8,
        flowLimitMlS: 4.5,
      },
      {
        id: 's4',
        kind: 'infusion',
        label: 'Decline 3',
        durationS: 5,
        pressureBar: 7,
        endPressureBar: 7,
        flowLimitMlS: 4.5,
      },
      {
        id: 's5',
        kind: 'infusion',
        label: 'Decline 4',
        durationS: 5,
        pressureBar: 6,
        endPressureBar: 6,
        flowLimitMlS: 4.5,
      },
      {
        id: 's6',
        kind: 'infusion',
        label: 'Decline 5',
        durationS: 5,
        pressureBar: 5,
        endPressureBar: 5,
        flowLimitMlS: 4.5,
      },
      {
        id: 's7',
        kind: 'rampdown',
        label: 'Decline 6',
        durationS: 5,
        pressureBar: 4,
        endPressureBar: 4,
        flowLimitMlS: 4.5,
      },
    ],
  },
  {
    name: 'Turbo Shot',
    description: 'Coarse grind, low pressure, short time. Grind coarser than you think.',
    doseG: 18,
    ratio: 3,
    brewTempC: 93,
    stages: [
      {
        id: 's1',
        kind: 'infusion',
        label: 'Infusion',
        durationS: 17,
        pressureBar: 6,
        endPressureBar: 6,
        flowLimitMlS: 4.5,
      },
    ],
  },
];

/* ── The shot as the machine actually lets you build it ────────────────────── */

/**
 * `Es1Stage[]` is the storage and wire shape: a flat, ordered list. It can
 * express things the ES1 cannot — a sloped infusion, two ramp-downs, a flow limit
 * on a step that has no flow field — which is why `describePayloadLoss` had to
 * exist.
 *
 * The machine's own editor is narrower, and these types say so:
 *   - pre-infusion, optional, with duration + hold pressure + fill flow
 *   - one or more infusion steps, each just duration + pressure
 *   - a ramp-down, optional, with duration + end pressure
 *
 * A falling curve is successive flat infusion steps, not a slope. The ramp-down
 * starts wherever the last infusion left off, so its start pressure is derived
 * rather than entered.
 */
export interface PreInfusionStep {
  id: string;
  durationS: number;
  pressureBar: number;
  flowLimitMlS: number;
}

export interface InfusionStep {
  id: string;
  durationS: number;
  pressureBar: number;
}

export interface RampDownStep {
  id: string;
  durationS: number;
  endPressureBar: number;
}

export interface Es1Shot {
  preInfusion: PreInfusionStep | null;
  /** Never empty — a shot with no infusion is not a shot. */
  infusions: InfusionStep[];
  rampDown: RampDownStep | null;
}

/** Read a stored profile as the machine would present it. */
export function splitStages(stages: Es1Stage[]): Es1Shot {
  const pre = stages.find((s) => s.kind === 'preinfusion') ?? null;
  const ramp = stages.find((s) => s.kind === 'rampdown') ?? null;
  const infusions = stages
    .filter((s) => s.kind === 'infusion')
    .map((s) => ({ id: s.id, durationS: s.durationS, pressureBar: s.pressureBar }));

  return {
    preInfusion: pre
      ? {
          id: pre.id,
          durationS: pre.durationS,
          pressureBar: pre.pressureBar,
          flowLimitMlS: pre.flowLimitMlS,
        }
      : null,
    // A profile that somehow arrived with no infusion still has to be editable.
    infusions: infusions.length ? infusions : [{ id: 'inf0', durationS: 22, pressureBar: 9 }],
    rampDown: ramp
      ? { id: ramp.id, durationS: ramp.durationS, endPressureBar: ramp.endPressureBar }
      : null,
  };
}

/** Write it back, in the order the machine runs it. */
export function buildStages(shot: Es1Shot): Es1Stage[] {
  const stages: Es1Stage[] = [];

  if (shot.preInfusion) {
    const p = shot.preInfusion;
    stages.push({
      id: p.id,
      kind: 'preinfusion',
      label: 'Pre-infusion',
      durationS: p.durationS,
      // Flat: the machine holds one pressure through pre-infusion.
      pressureBar: p.pressureBar,
      endPressureBar: p.pressureBar,
      flowLimitMlS: p.flowLimitMlS,
    });
  }

  shot.infusions.forEach((inf, i) => {
    stages.push({
      id: inf.id,
      kind: 'infusion',
      label: shot.infusions.length > 1 ? `Infusion ${i + 1}` : 'Infusion',
      durationS: inf.durationS,
      pressureBar: inf.pressureBar,
      endPressureBar: inf.pressureBar,
      // No flow field on the wire for infusion; carry the observed constant.
      flowLimitMlS: ASSUMED_FLOW_ML_S,
    });
  });

  if (shot.rampDown) {
    const r = shot.rampDown;
    stages.push({
      id: r.id,
      kind: 'rampdown',
      label: 'Ramp down',
      durationS: r.durationS,
      // Starts wherever the last infusion ended — not something you set.
      pressureBar: shot.infusions.at(-1)?.pressureBar ?? r.endPressureBar,
      endPressureBar: r.endPressureBar,
      flowLimitMlS: ASSUMED_FLOW_ML_S,
    });
  }

  return stages;
}

/** Matches the value `fromEs1Wire` reconstructs with. */
const ASSUMED_FLOW_ML_S = 4.5;
