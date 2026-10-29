/**
 * Dependency-free tests for the pure logic. Run with:
 *   pnpm test
 * which is `node --experimental-strip-types --test` — no test runner to install.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BUILT_IN_GRINDERS,
  GRINDERS_BY_ID,
  calibrateFromTwoPoints,
  grindSettingError,
  convertSetting,
  grindBucket,
  settingToMicrons,
  snapToScale,
  specToUserGrinder,
} from './grinders.ts';
import { ES1_LIMITS, STOCK_PROFILES, pressureCurve, totalDurationS, yieldG } from './es1.ts';
import {
  BUILT_IN_MACHINES,
  NO_MACHINE_CAPABILITIES,
  activeMachine,
  capabilitiesOf,
  specToUserMachine,
} from './machines.ts';
import { coffeeExtractionSchema, profileNameFor, suggestionToProfile } from './ai.ts';
import { NUDGE_LIMITS, baselineFor } from './baseline.ts';
import { buildStages, splitStages } from './es1.ts';
import { roundF } from './temp.ts';
import {
  accountUpdateSchema,
  es1ProfileSchema,
  es1StageSchema,
  fellowOptInSchema,
} from './schemas.ts';
import { flowRate, ratioOf, suggestNextShot } from './dialin.ts';
import {
  RECOMMENDATIONS_BY_ID,
  RECOMMENDED_GRINDERS,
  RECOMMENDED_MACHINES,
  priceTier,
  sortByPrice,
} from './recommendations.ts';

const g = (id: string) => specToUserGrinder(GRINDERS_BY_ID[id]);

test('every built-in grinder has a unique id and a sane dial', () => {
  const ids = new Set<string>();
  for (const spec of BUILT_IN_GRINDERS) {
    assert.ok(!ids.has(spec.id), `duplicate grinder id: ${spec.id}`);
    ids.add(spec.id);
    assert.ok(spec.scale.max > spec.scale.min, `${spec.id} dial is inverted`);
    assert.ok(spec.scale.step > 0, `${spec.id} step must be positive`);
  }
});

test('every espresso range lands inside a plausible espresso particle window', () => {
  // The whole point of the micron model is cross-grinder comparability. If a
  // grinder's own espresso window maps somewhere absurd, the model is wrong for
  // that grinder and conversions through it will be wrong too.
  for (const spec of BUILT_IN_GRINDERS) {
    if (!spec.espressoRange) continue;
    const [lo, hi] = spec.espressoRange;
    const loUm = settingToMicrons(specToUserGrinder(spec), lo);
    const hiUm = settingToMicrons(specToUserGrinder(spec), hi);
    assert.ok(loUm >= 150 && loUm <= 320, `${spec.id} fine end is ${Math.round(loUm)}µm`);
    assert.ok(hiUm >= 300 && hiUm <= 520, `${spec.id} coarse end is ${Math.round(hiUm)}µm`);
    assert.ok(hiUm > loUm, `${spec.id} espresso range is backwards`);
  }
});

test('converting a setting there and back is stable within one step', () => {
  const from = g('fellow-opus-2');
  const to = g('1zpresso-j-ultra');
  for (const setting of [0.4, 0.8, 1.2, 1.6]) {
    const there = convertSetting(from, setting, to);
    const back = convertSetting(to, there.setting, from);
    assert.ok(
      Math.abs(back.setting - setting) <= from.scale.step,
      `round trip drifted: ${setting} -> ${there.setting} -> ${back.setting}`,
    );
  }
});

test('conversion confidence is the weaker of the two calibrations', () => {
  const measured = {
    name: 'calibrated',
    scale: g('niche-zero').scale,
    calibration: calibrateFromTwoPoints(
      { setting: 10, microns: 230 },
      { setting: 25, microns: 455 },
    ),
  };
  const estimated = g('fellow-opus-2'); // estimated
  assert.equal(convertSetting(measured, 30, estimated).confidence, 'estimated');
  assert.equal(convertSetting(estimated, 4, measured).confidence, 'estimated');
});

test('a setting off the end of the target dial is flagged, not silently clamped away', () => {
  const ode = g('fellow-ode-2'); // coarse, brew-focused
  const jMax = g('1zpresso-j-max');
  const result = convertSetting(ode, 11, jMax); // very coarse -> past the end of the J-Max dial
  assert.equal(result.outOfRange, true);
  assert.equal(result.setting, jMax.scale.max);
});

test('the Opus 2 is a stepless 0-10 dial, not the original 41 clicks', () => {
  const opus2 = GRINDERS_BY_ID['fellow-opus-2'];
  assert.equal(opus2.scale.kind, 'stepless');
  assert.deepEqual([opus2.scale.min, opus2.scale.max], [0, 10]);
  assert.equal(opus2.burrSizeMm, 48);
});

test('grind settings must be on the dial and, for stepped dials, on a step', () => {
  const opus = g('fellow-opus'); // clicks 1-41
  assert.equal(grindSettingError(opus, 12), null);
  assert.match(grindSettingError(opus, 0)!, /goes from 1 to 41$/);
  assert.match(grindSettingError(opus, 42)!, /goes from 1 to 41$/);
  assert.match(grindSettingError(opus, 4.5)!, /steps of 1$/);

  const ode = g('fellow-ode-2'); // stepped, 0.1 marks
  assert.equal(grindSettingError(ode, 2.3), null); // 0.1-step float dust must not trip it
  assert.match(grindSettingError(ode, 2.35)!, /steps of 0\.1$/);

  const opus2 = g('fellow-opus-2'); // stepless: range only
  assert.equal(grindSettingError(opus2, 1.25), null);
  assert.match(grindSettingError(opus2, 10.5)!, /goes from 0 to 10$/);
  assert.equal(grindSettingError(opus2, Number.NaN), 'Grind setting must be a number');
});

test('snapping respects step size without floating-point dust', () => {
  const df64 = g('df64'); // 0.1 turn steps
  assert.equal(snapToScale(df64, 1.23), 1.2);
  assert.equal(snapToScale(df64, 1.26), 1.3);
  assert.equal(snapToScale(df64, -5), 0);
  assert.equal(snapToScale(df64, 99), 10);
});

test('two-point calibration reproduces its own reference points', () => {
  const cal = calibrateFromTwoPoints({ setting: 10, microns: 300 }, { setting: 20, microns: 500 });
  const grinder = { name: 'test', scale: g('niche-zero').scale, calibration: cal };
  assert.equal(settingToMicrons(grinder, 10), 300);
  assert.equal(settingToMicrons(grinder, 20), 500);
  assert.throws(() =>
    calibrateFromTwoPoints({ setting: 5, microns: 200 }, { setting: 5, microns: 400 }),
  );
});

test('grind buckets are ordered and cover the range', () => {
  assert.equal(grindBucket(250), 'Espresso');
  assert.equal(grindBucket(600), 'Medium (pour over)');
  assert.equal(grindBucket(1200), 'Extra coarse (cold brew)');
});

test('every stock profile is inside the ES1 hardware limits', () => {
  for (const p of STOCK_PROFILES) {
    assert.ok(p.brewTempC >= ES1_LIMITS.tempC.min && p.brewTempC <= ES1_LIMITS.tempC.max, p.name);
    assert.ok(p.stages.length >= 1 && p.stages.length <= ES1_LIMITS.stages.max, p.name);
    assert.ok(totalDurationS(p) <= ES1_LIMITS.totalDurationS.max, p.name);
    for (const s of p.stages) {
      assert.ok(s.pressureBar <= ES1_LIMITS.pressureBar.max, `${p.name}: ${s.pressureBar} bar`);
      assert.ok(
        s.endPressureBar <= ES1_LIMITS.pressureBar.max,
        `${p.name}: ${s.endPressureBar} bar`,
      );
      assert.ok(s.flowLimitMlS <= ES1_LIMITS.flowMlS.max, `${p.name}: ${s.flowLimitMlS} ml/s`);
      assert.ok(s.durationS >= 1, `${p.name}: ${s.durationS}s stage`);
    }
  }
});

test('the pressure curve starts at t=0 and ends at the shot length', () => {
  const lever = STOCK_PROFILES.find((p) => p.name === 'Lever')!;
  const curve = pressureCurve(lever);
  assert.equal(curve[0].t, 0);
  assert.equal(curve[curve.length - 1].t, totalDurationS(lever));
  // The Lever profile descends: its last infusion pressure is below its first.
  assert.ok(lever.stages[lever.stages.length - 1].pressureBar < lever.stages[1].pressureBar);
});

test('yield follows dose and ratio', () => {
  assert.equal(yieldG({ doseG: 18, ratio: 2 }), 36);
  assert.equal(yieldG({ doseG: 18, ratio: 2.5 }), 45);
});

test('dial-in suggests finer for a fast sour shot and coarser for a slow bitter one', () => {
  const fastSour = suggestNextShot({ doseG: 18, yieldG: 44, shotTimeS: 16, tasteBalance: -2 });
  assert.equal(fastSour.direction, 'finer');
  assert.equal(fastSour.confidence, 'high');

  const slowBitter = suggestNextShot({ doseG: 18, yieldG: 40, shotTimeS: 36, tasteBalance: 2 });
  assert.equal(slowBitter.direction, 'coarser');

  const onTarget = suggestNextShot({ doseG: 18, yieldG: 48, shotTimeS: 29, tasteBalance: 0 });
  assert.equal(onTarget.direction, 'hold');
});

test('on-time but off-taste shots change the ratio, not the grind', () => {
  assert.equal(
    suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28, tasteBalance: -1 }).direction,
    'more-yield',
  );
  assert.equal(
    suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28, tasteBalance: 1 }).direction,
    'less-yield',
  );
});

test('a shot with no taste rating gets a low-confidence hold', () => {
  const s = suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28 });
  assert.equal(s.direction, 'hold');
  assert.equal(s.confidence, 'low');
});

test('flow rate excludes pre-infusion', () => {
  assert.equal(ratioOf({ doseG: 18, yieldG: 36, shotTimeS: 28 }), 2);
  assert.equal(flowRate({ doseG: 18, yieldG: 36, shotTimeS: 30, preInfusionS: 10 }), 1.8);
});

test('every built-in machine round-trips through specToUserMachine', () => {
  for (const spec of BUILT_IN_MACHINES) {
    const m = specToUserMachine(spec);
    assert.equal(m.builtInId, spec.id, spec.id);
    assert.ok(m.name.includes(spec.model), spec.id);
    assert.deepEqual(m.capabilities, spec.capabilities, spec.id);
    assert.deepEqual(m.limits, spec.limits, spec.id);
    assert.ok(m.limits.tempC.min < m.limits.tempC.max, spec.id);
  }
});

test('specToUserMachine copies rather than aliases the spec', () => {
  const spec = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  const mine = specToUserMachine(spec);
  mine.limits.tempC.max = 200;
  mine.capabilities.profiling = 'none';
  assert.equal(spec.limits.tempC.max, 94, 'catalogue temp must not be mutated');
  assert.equal(spec.capabilities.profiling, 'pressure', 'catalogue capability must not be mutated');
});

test('the ES1 spec agrees with the ES1 profile limits', () => {
  const es1 = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  assert.equal(es1.limits.tempC.min, ES1_LIMITS.tempC.min);
  assert.equal(es1.limits.tempC.max, ES1_LIMITS.tempC.max);
  assert.equal(es1.limits.maxPressureBar, ES1_LIMITS.pressureBar.max);
});

test('only a machine that profiles offers a profile studio', () => {
  const es1 = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  const generic = BUILT_IN_MACHINES.find((m) => m.id === 'generic-espresso')!;
  assert.equal(es1.capabilities.profiling, 'pressure');
  assert.equal(es1.capabilities.cloud, 'fellow');
  assert.equal(generic.capabilities.profiling, 'none');
  assert.equal(generic.capabilities.cloud, null, 'a machine we cannot talk to gets no cloud page');
});

test('activeMachine prefers the default and falls back to the first', () => {
  const a = { id: 'a', isDefault: false };
  const b = { id: 'b', isDefault: true };
  assert.equal(activeMachine([a, b])?.id, 'b');
  assert.equal(activeMachine([a])?.id, 'a', 'no default: fall back rather than strand the user');
  assert.equal(activeMachine([]), null);
});

test('capabilitiesOf treats an empty bench as the plain logbook', () => {
  assert.deepEqual(capabilitiesOf(null), NO_MACHINE_CAPABILITIES);
  assert.equal(capabilitiesOf(null).profiling, 'none');
  assert.equal(capabilitiesOf(null).cloud, null);
});

// A suggested profile's numbers come from rules, not the model. These pin the
// two properties that matter: the same coffee always gets the same curve, and
// nothing the model sends can push it past what the machine accepts.
const ROASTS = [null, 'light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
const PROCESSES = [
  null,
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'experimental',
  'other',
] as const;
const ALTITUDES = [null, 900, 1500, 2200];
const HI_FI = { roastLevel: 'medium-dark', process: 'natural', altitudeMasl: 1000 } as const;
const NO_NUDGE = {
  description: 'For a soft natural.',
  tempNudgeF: 0,
  ratioNudge: 0,
  rationale: '',
};

test('the same coffee always gets the same baseline', () => {
  assert.deepEqual(baselineFor(HI_FI), baselineFor({ ...HI_FI }));
});

test('every coffee the app can describe gets a profile the machine accepts', () => {
  for (const roastLevel of ROASTS)
    for (const process of PROCESSES)
      for (const altitudeMasl of ALTITUDES) {
        const base = baselineFor({ roastLevel, process, altitudeMasl });
        // The extremes of what the model may nudge, and then some.
        for (const tempNudgeF of [-9, 0, 9])
          for (const ratioNudge of [-1, 0, 1]) {
            const p = suggestionToProfile(
              base,
              { ...NO_NUDGE, tempNudgeF, ratioNudge },
              'Any coffee',
              (i) => `s${i}`,
            );
            const check = es1ProfileSchema.safeParse(p);
            assert.ok(
              check.success,
              `${roastLevel}/${process}/${altitudeMasl} ${tempNudgeF}/${ratioNudge}: ${check.error?.issues[0]?.message}`,
            );
          }
      }
});

test('lighter roasts run hotter, longer and at a longer ratio than darker ones', () => {
  const at = (roastLevel: (typeof ROASTS)[number]) =>
    baselineFor({ roastLevel, process: null, altitudeMasl: null });
  const order = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
  for (let i = 1; i < order.length; i++) {
    const lighter = at(order[i - 1]);
    const darker = at(order[i]);
    assert.ok(lighter.brewTempF > darker.brewTempF, `${order[i - 1]} hotter than ${order[i]}`);
    assert.ok(lighter.ratio > darker.ratio, `${order[i - 1]} longer ratio than ${order[i]}`);
  }
  const { reasons: _unknown, ...unknown } = at(null);
  const { reasons: _medium, ...medium } = at('medium');
  assert.deepEqual(unknown, medium, 'an unknown roast starts from medium');
});

test('a fragile process gets a slower, longer pre-infusion, even on a dark roast', () => {
  const dark = baselineFor({ roastLevel: 'dark', process: 'washed', altitudeMasl: null });
  const darkNatural = baselineFor({ roastLevel: 'dark', process: 'natural', altitudeMasl: null });
  assert.notEqual(dark.stages[0].kind, 'preinfusion');
  assert.equal(darkNatural.stages[0].kind, 'preinfusion');
  assert.ok(darkNatural.stages[0].flowLimitMlS < 4.5);
  assert.equal(darkNatural.brewTempF, dark.brewTempF - 1);
});

test('altitude moves the temperature, and never past 201 °F', () => {
  const at = (altitudeMasl: number | null) =>
    baselineFor({ roastLevel: 'medium', process: null, altitudeMasl }).brewTempF;
  assert.equal(at(2200), at(null) + 1);
  assert.equal(at(900), at(null) - 1);
  assert.equal(
    baselineFor({ roastLevel: 'light', process: null, altitudeMasl: 2200 }).brewTempF,
    201,
  );
});

test('the model can only nudge temperature and ratio, and only so far', () => {
  const base = baselineFor(HI_FI);
  const p = suggestionToProfile(
    base,
    { ...NO_NUDGE, tempNudgeF: 7, ratioNudge: -0.9 },
    'Hi-Fi Espresso',
    (i) => `s${i}`,
  );
  assert.equal(roundF(p.brewTempC), base.brewTempF + NUDGE_LIMITS.tempF);
  assert.equal(p.ratio, Math.round((base.ratio - NUDGE_LIMITS.ratio) * 10) / 10);
  assert.deepEqual(
    p.stages.map(({ id: _id, ...st }) => st),
    base.stages,
    'the curve is the baseline, whatever the model sends',
  );
});

test('a nudge lands on whole degrees and tenths of a ratio', () => {
  const base = baselineFor(HI_FI);
  const p = suggestionToProfile(
    base,
    { ...NO_NUDGE, tempNudgeF: 1.4, ratioNudge: 0.13 },
    'Hi-Fi Espresso',
    (i) => `s${i}`,
  );
  assert.equal(roundF(p.brewTempC), base.brewTempF + 1);
  assert.equal(p.ratio, Math.round((base.ratio + 0.1) * 10) / 10);
});

test('the profile stores Celsius for the Fahrenheit it was worked out in', () => {
  const base = baselineFor({ roastLevel: 'light', process: 'washed', altitudeMasl: null });
  const p = suggestionToProfile(base, NO_NUDGE, 'Guji Hambela', (i) => `s${i}`);
  assert.equal(roundF(p.brewTempC), 201);
  assert.ok(Math.abs(p.brewTempC - 93.888) < 0.01, `got ${p.brewTempC}`);
  assert.equal(p.stages[0].id, 's0', 'every stage gets an id the editor can key on');
});

test('a suggested profile is named for its coffee and its curve, not by the model', () => {
  const p = suggestionToProfile(
    baselineFor(HI_FI),
    NO_NUDGE,
    '  Hi-Fi   Espresso ',
    (i) => `s${i}`,
  );
  assert.equal(p.name, 'Hi-Fi Espresso · Stepped down');
});

test('every roast names its curve differently', () => {
  const shapes = ROASTS.filter((r) => r !== null).map(
    (roastLevel) => baselineFor({ roastLevel, process: null, altitudeMasl: null }).shape,
  );
  assert.equal(new Set(shapes).size, shapes.length);
});

test('a long coffee name is cut to fit, and the curve keeps its place', () => {
  const long = 'Finca El Paraíso Lychee Thermal Shock Double Anaerobic Castillo Microlot';
  const name = profileNameFor(long, 'Stepped down');
  assert.equal(name.length, 50);
  assert.ok(name.endsWith('… · Stepped down'), name);
  const p = suggestionToProfile(baselineFor(HI_FI), NO_NUDGE, long, (i) => `s${i}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, true, 'still a valid profile');
});

test('the extraction schema keeps unstated fields null rather than inventing them', () => {
  const parsed = coffeeExtractionSchema.safeParse({
    name: 'Guji Uraga',
    roaster: 'Onyx',
    origin: 'Ethiopia',
    region: null,
    producer: null,
    varietal: null,
    process: null,
    roastLevel: null,
    altitudeMasl: null,
    tastingNotes: ['peach', 'jasmine'],
    notFound: ['region', 'producer', 'varietal', 'process', 'roastLevel', 'altitudeMasl'],
    derived: [],
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.process, null);
  assert.equal(parsed.success && parsed.data.notFound.length, 6);
});

test('anything filled from knowledge rather than the page must be declared', () => {
  // The page that prompted this says "San Adolfo" and never names the country, so
  // completing it is useful -- but the user has to be told it was completed.
  const parsed = coffeeExtractionSchema.safeParse({
    name: 'Outpost Coffee',
    roaster: 'PERC COFFEE',
    origin: 'Colombia',
    region: 'San Adolfo, Huila',
    producer: 'Jhon Rodriguez',
    varietal: 'Caturra',
    process: 'washed',
    roastLevel: null,
    altitudeMasl: 1700,
    tastingNotes: ['graham cracker', 'marshmallow'],
    notFound: ['roastLevel'],
    derived: ['origin'],
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data.derived, ['origin']);
});

test('the extraction schema rejects a process the app cannot store', () => {
  const bad = coffeeExtractionSchema.safeParse({
    name: 'x',
    roaster: 'y',
    origin: null,
    region: null,
    producer: null,
    varietal: null,
    process: 'carbonic-maceration-double-fermented',
    roastLevel: null,
    altitudeMasl: null,
    tastingNotes: [],
    notFound: [],
    derived: [],
  });
  assert.equal(bad.success, false);
});

// The machine's editor is narrower than the storage format: pre-infusion and
// ramp-down are toggles, infusion is one-or-more flat steps, and a falling curve
// is successive steps rather than a slope. These pin that shape.
const SHOT = {
  preInfusion: { id: 'p1', durationS: 12, pressureBar: 3, flowLimitMlS: 4 },
  infusions: [
    { id: 'i1', durationS: 10, pressureBar: 9 },
    { id: 'i2', durationS: 10, pressureBar: 6 },
  ],
  rampDown: { id: 'r1', durationS: 5, endPressureBar: 3 },
};

test('a shot builds into stages in the order the machine runs them', () => {
  const stages = buildStages(SHOT);
  assert.deepEqual(
    stages.map((s) => s.kind),
    ['preinfusion', 'infusion', 'infusion', 'rampdown'],
  );
  assert.deepEqual(
    stages.map((s) => s.label),
    ['Pre-infusion', 'Infusion 1', 'Infusion 2', 'Ramp down'],
  );
});

test('every infusion step is flat — a curve is made of steps, not slopes', () => {
  for (const s of buildStages(SHOT).filter((x) => x.kind === 'infusion')) {
    assert.equal(s.pressureBar, s.endPressureBar, `${s.label} sloped`);
  }
});

test('the ramp-down starts where the last infusion ended', () => {
  const ramp = buildStages(SHOT).find((s) => s.kind === 'rampdown')!;
  assert.equal(ramp.pressureBar, 6, 'derived from the final infusion, not entered');
  assert.equal(ramp.endPressureBar, 3);
});

test('splitting and rebuilding is lossless', () => {
  const stages = buildStages(SHOT);
  assert.deepEqual(buildStages(splitStages(stages)), stages);
});

test('both optional phases can be off, leaving a bare infusion', () => {
  const stages = buildStages({ ...SHOT, preInfusion: null, rampDown: null });
  assert.deepEqual(
    stages.map((s) => s.kind),
    ['infusion', 'infusion'],
  );
  assert.equal(es1ProfileSchema.safeParse({ ...GOOD_PROFILE, stages }).success, true);
});

test('a profile that arrives with no infusion is still editable', () => {
  // Not reachable through the editor, but a hand-edited or imported profile
  // could be shaped this way and must not produce an empty form.
  const shot = splitStages([]);
  assert.equal(shot.infusions.length, 1);
  assert.equal(shot.preInfusion, null);
});

test('a single infusion is labelled without a number', () => {
  const stages = buildStages({ ...SHOT, infusions: [SHOT.infusions[0]] });
  assert.equal(stages.find((s) => s.kind === 'infusion')!.label, 'Infusion');
});

test('pre-infusion may run longer than an infusion step', () => {
  // 90s is legal on the machine and used to fail, because one duration bound was
  // applied to every kind.
  const stages = buildStages({ ...SHOT, preInfusion: { ...SHOT.preInfusion, durationS: 90 } });
  const parsed = es1StageSchema.safeParse(stages[0]);
  assert.equal(parsed.success, true);
  assert.equal(es1StageSchema.safeParse({ ...stages[1], durationS: 90 }).success, false);
});

const GOOD_PROFILE = { id: 'p', name: 'x', doseG: 18, ratio: 2, brewTempC: 93, stages: [] };

test('the Fellow opt-in takes an explicit yes and nothing looser', () => {
  assert.equal(fellowOptInSchema.safeParse({ accept: true }).success, true);
  for (const body of [{}, { accept: false }, { accept: 'true' }, { accept: 1 }, null]) {
    assert.equal(fellowOptInSchema.safeParse(body).success, false, JSON.stringify(body));
  }
});

test('account update trims names and needs a first name', () => {
  assert.deepEqual(accountUpdateSchema.parse({ firstName: '  Ada ', lastName: ' Lovelace ' }), {
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
  assert.deepEqual(accountUpdateSchema.parse({ firstName: 'Ada', lastName: '' }), {
    firstName: 'Ada',
    lastName: '',
  });
  assert.equal(
    accountUpdateSchema.safeParse({ firstName: '   ', lastName: 'Lovelace' }).success,
    false,
  );
  assert.equal(accountUpdateSchema.safeParse({ firstName: 'Ada' }).success, false);
  assert.equal(
    accountUpdateSchema.safeParse({ firstName: 'A'.repeat(257), lastName: '' }).success,
    false,
  );
});

test('every recommendation maps onto a real spec, and grinders onto their own', () => {
  for (const r of RECOMMENDED_MACHINES) {
    assert.equal(r.kind, 'machine');
    assert.ok(
      BUILT_IN_MACHINES.some((m) => m.id === r.builtInId),
      `${r.id}: no machine spec ${r.builtInId}`,
    );
  }
  for (const r of RECOMMENDED_GRINDERS) {
    assert.equal(r.kind, 'grinder');
    assert.equal(r.builtInId, r.id, `${r.id} should point at its own grinder spec`);
    assert.ok(GRINDERS_BY_ID[r.builtInId!], `${r.id}: no grinder spec`);
  }
});

test('a machine only pairs with grinders the guide actually lists', () => {
  for (const r of RECOMMENDED_MACHINES) {
    for (const pid of r.pairsWith ?? []) {
      assert.equal(
        RECOMMENDATIONS_BY_ID[pid]?.kind,
        'grinder',
        `${r.id} pairs with unknown ${pid}`,
      );
    }
  }
});

test('sortByPrice orders both ways, keeps ties stable, and leaves the input alone', () => {
  const list = [
    { id: 'b', priceUsd: 200 },
    { id: 'a', priceUsd: 100 },
    { id: 'c', priceUsd: 200 },
  ];
  assert.deepEqual(
    sortByPrice(list, 'asc').map((x) => x.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    sortByPrice(list, 'desc').map((x) => x.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    list.map((x) => x.id),
    ['b', 'a', 'c'],
  );
});

test('price tiers use separate bands for machines and grinders', () => {
  assert.equal(priceTier({ kind: 'machine', priceUsd: 450 }), '$');
  assert.equal(priceTier({ kind: 'machine', priceUsd: 900 }), '$$');
  assert.equal(priceTier({ kind: 'machine', priceUsd: 1500 }), '$$$');
  assert.equal(priceTier({ kind: 'grinder', priceUsd: 100 }), '$');
  assert.equal(priceTier({ kind: 'grinder', priceUsd: 200 }), '$$');
  assert.equal(priceTier({ kind: 'grinder', priceUsd: 400 }), '$$$');
});
