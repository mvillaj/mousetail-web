import { z } from 'zod';
import { ES1_LIMITS } from './es1.ts';

const L = ES1_LIMITS;

export const grinderScaleSchema = z.object({
  kind: z.enum(['clicks', 'stepped', 'stepless']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unitLabel: z.string().min(1).max(20),
});

export const grinderCalibrationSchema = z.object({
  umPerUnit: z.number(),
  interceptUm: z.number(),
  source: z.enum(['measured', 'community', 'estimated']),
});

export const grinderInputSchema = z.object({
  builtInId: z.string().nullish(),
  name: z.string().min(1).max(80),
  burrType: z.enum(['conical', 'flat', 'ghost', 'unknown']).nullish(),
  scale: grinderScaleSchema,
  calibration: grinderCalibrationSchema,
  isDefault: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
});

export const machineCapabilitiesSchema = z.object({
  profiling: z.enum(['none', 'pressure']),
  cloud: z.enum(['fellow']).nullable(),
});

export const machineLimitsSchema = z.object({
  tempC: z.object({ min: z.number(), max: z.number() }),
  maxPressureBar: z.number().positive(),
});

export const machineInputSchema = z.object({
  builtInId: z.string().nullish(),
  name: z.string().min(1).max(80),
  capabilities: machineCapabilitiesSchema,
  limits: machineLimitsSchema,
  isDefault: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
});

export const coffeeInputSchema = z.object({
  name: z.string().min(1).max(120),
  roaster: z.string().min(1).max(120),
  origin: z.string().max(120).nullish(),
  region: z.string().max(120).nullish(),
  producer: z.string().max(120).nullish(),
  varietal: z.string().max(120).nullish(),
  process: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'experimental', 'other']).nullish(),
  roastLevel: z.enum(['light', 'medium-light', 'medium', 'medium-dark', 'dark']).nullish(),
  altitudeMasl: z.number().int().min(0).max(4000).nullish(),
  roastDate: z.string().nullish(),
  tastingNotes: z.array(z.string().max(40)).max(12).default([]),
  url: z.string().url().max(500).nullish().or(z.literal('')),
  notes: z.string().max(4000).nullish(),
  isPublic: z.boolean().default(false),
});

export const shotInputSchema = z.object({
  coffeeId: z.string().nullish(),
  grinderId: z.string().nullish(),
  machineId: z.string().nullish(),
  profileId: z.string().nullish(),
  brewedAt: z.string().optional(),
  grindSetting: z.number().nullish(),
  doseG: z.number().min(1).max(50),
  yieldG: z.number().min(1).max(200),
  shotTimeS: z.number().min(1).max(300),
  preInfusionS: z.number().min(0).max(120).nullish(),
  brewTempC: z.number().min(0).max(130).nullish(),
  peakPressureBar: z.number().min(0).max(15).nullish(),
  basket: z.string().max(60).nullish(),
  wdt: z.boolean().default(false),
  rating: z.number().int().min(1).max(5).nullish(),
  tasteBalance: z.number().int().min(-2).max(2).nullish(),
  flavourNotes: z.array(z.string().max(40)).max(12).default([]),
  notes: z.string().max(4000).nullish(),
});

export const es1StageSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['preinfusion', 'infusion', 'rampdown']),
    label: z.string().max(40).optional(),
    durationS: z.number(),
    pressureBar: z.number().min(L.pressureBar.min).max(L.pressureBar.max),
    endPressureBar: z.number().min(L.pressureBar.min).max(L.pressureBar.max),
    flowLimitMlS: z.number().min(L.flowMlS.min).max(L.flowMlS.max),
  })
  .strict()
  // Pre-infusion runs far longer than an infusion step — 1-120s against 1-60s —
  // so a single bound across every kind rejected shots the machine accepts.
  .superRefine((stage, ctx) => {
    const bound = stage.kind === 'preinfusion' ? L.preInfusion.durationS : L.stageDurationS;
    if (stage.durationS < bound.min || stage.durationS > bound.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationS'],
        message:
          stage.kind === 'preinfusion'
            ? `Pre-infusion runs ${bound.min}-${bound.max}s`
            : `A stage runs ${bound.min}-${bound.max}s`,
      });
    }
    if (stage.kind === 'preinfusion' && !Number.isInteger(stage.pressureBar)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pressureBar'],
        message: 'Pre-infusion holds a whole number of bar; the ES1 refuses a fraction',
      });
    }
  });

export const es1ProfileSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(50),
    description: z.string().max(500).optional(),
    doseG: z.number().min(L.doseG.min).max(L.doseG.max),
    ratio: z.number().min(L.ratio.min).max(L.ratio.max),
    brewTempC: z.number().min(L.tempC.min).max(L.tempC.max),
    stages: z.array(es1StageSchema).min(L.stages.min).max(L.stages.max),
  })
  .refine((p) => p.stages.reduce((s, x) => s + x.durationS, 0) <= L.totalDurationS.max, {
    message: `Total shot time must be ${L.totalDurationS.max}s or less`,
    path: ['stages'],
  });

export const brewProfileInputSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).nullish(),
  isPublic: z.boolean().default(false),
  profile: es1ProfileSchema,
});

export const fellowConnectSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Turning on the Fellow integration. `accept` must be literally true: the
 * server records it as the user's acknowledgement of the warning, so anything
 * looser than an explicit yes is a no.
 */
export const fellowOptInSchema = z.object({
  accept: z.literal(true),
});

/**
 * The Mousetail account fields a user edits in the app. Clerk is the source of
 * truth for both; the server writes them there and mirrors the result locally.
 * The limits are Clerk's own, so a value that passes here does not bounce there.
 */
export const accountUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'Add a first name').max(256),
  lastName: z.string().trim().max(256),
});

export const changeKinds = ['new', 'improved', 'fixed'] as const;

export const changelogEntryInputSchema = z.object({
  title: z.string().trim().min(1, 'Give the update a title').max(120),
  version: z.string().trim().max(20).nullish(),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  changes: z
    .array(z.object({ kind: z.enum(changeKinds), text: z.string().trim().min(1).max(300) }))
    .max(50),
  body: z.string().max(20000).default(''),
});

export type GrinderInput = z.infer<typeof grinderInputSchema>;
export type MachineInput = z.infer<typeof machineInputSchema>;
export type CoffeeInput = z.infer<typeof coffeeInputSchema>;
export type ShotInput = z.infer<typeof shotInputSchema>;
export type BrewProfileInput = z.infer<typeof brewProfileInputSchema>;
export type ChangelogEntryInput = z.infer<typeof changelogEntryInputSchema>;
