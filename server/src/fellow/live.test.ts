import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  describePayloadLoss,
  fromEs1Wire,
  isEditable,
  liveFellowClient,
  preservedFrom,
  profileOrigin,
  toEs1Payload,
} from './live.ts';
import type { Es1WireProfileRead } from './live.ts';

/**
 * Fixtures are verbatim from a GET of a real account on 2026-08-28, trimmed to
 * the profile fields. If Fellow changes the wire format these fail, which is the
 * point: the mapping is reverse-engineered and has no contract behind it.
 */

/** Factory profile. Six flat infusion steps are how the ES1 spells a lever curve. */
const LEVER: Es1WireProfileRead = {
  id: '5_lever',
  title: 'Lever',
  grindSize: 0,
  dose: 18,
  ratio: 2.5,
  temperature: 94,
  transition: 'smooth',
  adaptive: false,
  decliningTemp: 'off',
  preInfusionEnabled: true,
  preInfusionHoldPressure: 3,
  preInfusionFillFlowRate: 3,
  preInfusionDuration: 10,
  infusion: [
    { duration: 5, pressure: 9 },
    { duration: 5, pressure: 8 },
    { duration: 5, pressure: 7 },
    { duration: 5, pressure: 6 },
    { duration: 5, pressure: 5 },
    { duration: 5, pressure: 4 },
  ],
  rampDownEnabled: false,
  rampDownEndPressure: 3,
  rampDownDuration: 5,
  folder: 'fellow',
  notes: 'Built to mimic the pressure curve of a spring lever machine.',
  settingsVersion: 0,
};

/** A user profile, with a ramp-down actually enabled. */
const CUSTOM: Es1WireProfileRead = {
  id: 'vB6YrHqqUllak3x',
  title: 'My Brew3',
  grindSize: 2,
  dose: 18,
  ratio: 2,
  temperature: 93.5,
  transition: 'fast',
  adaptive: false,
  decliningTemp: 'on',
  preInfusionEnabled: true,
  preInfusionHoldPressure: 9,
  preInfusionFillFlowRate: 4.5,
  preInfusionDuration: 1,
  infusion: [{ duration: 20, pressure: 9 }],
  rampDownEnabled: true,
  rampDownEndPressure: 6,
  rampDownDuration: 5,
  folder: 'custom',
  notes: '',
  settingsVersion: 1787926991,
  synced: true,
  version: 16,
};

test('a factory lever profile becomes pre-infusion plus six flat infusion stages', () => {
  const p = fromEs1Wire(LEVER);
  assert.equal(p.stages.length, 7);
  assert.equal(p.stages[0].kind, 'preinfusion');
  assert.equal(p.stages[0].durationS, 10);
  assert.equal(p.stages[0].flowLimitMlS, 3, 'pre-infusion carries a real flow field');
  assert.deepEqual(
    p.stages.slice(1).map((s) => s.pressureBar),
    [9, 8, 7, 6, 5, 4],
  );
  assert.ok(
    p.stages.every((s) => s.kind !== 'rampdown'),
    'rampDownEnabled is false, so no ramp stage even though the fields are populated',
  );
});

test('a ramp-down starts at the final infusion pressure and falls to the end pressure', () => {
  const ramp = fromEs1Wire(CUSTOM).stages.find((s) => s.kind === 'rampdown');
  assert.ok(ramp);
  assert.equal(ramp.pressureBar, 9);
  assert.equal(ramp.endPressureBar, 6);
  assert.equal(ramp.durationS, 5);
});

test('wire -> model -> wire preserves the shot', () => {
  for (const wire of [LEVER, CUSTOM]) {
    const out = toEs1Payload(fromEs1Wire(wire));
    assert.deepEqual(out.infusion, wire.infusion, wire.title);
    assert.equal(out.preInfusionEnabled, wire.preInfusionEnabled, wire.title);
    assert.equal(out.preInfusionDuration, wire.preInfusionDuration, wire.title);
    assert.equal(out.preInfusionHoldPressure, wire.preInfusionHoldPressure, wire.title);
    assert.equal(out.preInfusionFillFlowRate, wire.preInfusionFillFlowRate, wire.title);
    assert.equal(out.rampDownEnabled, wire.rampDownEnabled, wire.title);
    assert.equal(out.dose, wire.dose, wire.title);
    assert.equal(out.ratio, wire.ratio, wire.title);
    assert.equal(out.temperature, wire.temperature, wire.title);
    assert.equal(out.grindSize, wire.grindSize, wire.title);
  }
});

test('a round-tripped ramp-down keeps its end pressure and duration', () => {
  const out = toEs1Payload(fromEs1Wire(CUSTOM));
  assert.equal(out.rampDownEndPressure, 6);
  assert.equal(out.rampDownDuration, 5);
});

test('everything we write lands in the custom folder', () => {
  assert.equal(toEs1Payload(fromEs1Wire(LEVER)).folder, 'custom');
  assert.equal(profileOrigin(LEVER), 'factory');
  assert.equal(profileOrigin(CUSTOM), 'custom');
  assert.equal(profileOrigin({ ...LEVER, folder: 'drops' }), 'drop');
});

test('a sloped infusion stage is reported as lossy, a flat one is not', () => {
  const flat = fromEs1Wire(LEVER);
  assert.equal(
    describePayloadLoss(flat).filter((m) => m.includes('slope')).length,
    0,
    'the factory lever profile is already flat steps',
  );

  const sloped = fromEs1Wire(LEVER);
  sloped.stages[1] = { ...sloped.stages[1], endPressureBar: 4 };
  assert.ok(describePayloadLoss(sloped).some((m) => m.includes('slope')));
});

test('pre-infusion outside the machine limits is reported', () => {
  const p = fromEs1Wire(LEVER);
  p.stages[0] = { ...p.stages[0], durationS: 240 };
  assert.ok(describePayloadLoss(p).some((m) => m.includes('1-120s')));
});

// The existing suite only covers folders spelled the way we hoped. These cover
// the way the real captured account actually spells them, and the shape of a
// mistake: an unrecognised folder must read as read-only, not writable.
test('an unrecognised or missing folder is treated as read-only', () => {
  assert.equal(profileOrigin({ ...CUSTOM, folder: '' }), 'factory');
  assert.equal(profileOrigin({ ...CUSTOM, folder: 'somethingNew' }), 'factory');
  assert.equal(profileOrigin({ ...CUSTOM, folder: undefined as any }), 'factory');
  assert.equal(profileOrigin({ ...CUSTOM, folder: null as any }), 'factory');
});

test('folder matching is case- and whitespace-insensitive', () => {
  // The captured account spells the factory folder "Fellow", and has both
  // "drops" and "Drops" on sibling records.
  assert.equal(profileOrigin({ ...LEVER, folder: 'Fellow' }), 'factory');
  assert.equal(profileOrigin({ ...LEVER, folder: 'FELLOW' }), 'factory');
  assert.equal(profileOrigin({ ...LEVER, folder: '  fellow ' }), 'factory');
  assert.equal(profileOrigin({ ...LEVER, folder: 'Drops' }), 'drop');
  assert.equal(profileOrigin({ ...CUSTOM, folder: 'Custom' }), 'custom');
});

test('isDefaultProfile marks a factory profile whatever the folder says', () => {
  assert.equal(profileOrigin({ ...CUSTOM, isDefaultProfile: true }), 'factory');
  assert.equal(profileOrigin({ ...CUSTOM, isDefaultProfile: false }), 'custom');
});

test('only a custom profile is editable', () => {
  assert.equal(isEditable(CUSTOM), true);
  assert.equal(isEditable(LEVER), false);
  assert.equal(isEditable({ ...LEVER, folder: 'Fellow' }), false);
  assert.equal(isEditable({ ...CUSTOM, folder: 'mystery' }), false);
});

test('preserved wire fields survive a round-trip instead of reverting', () => {
  // CUSTOM carries transition 'fast' and decliningTemp 'on'; the observed
  // defaults are 'smooth' and 'off', so a bare round-trip silently rewrites them.
  const bare = toEs1Payload(fromEs1Wire(CUSTOM));
  assert.equal(bare.transition, 'smooth', 'without the original, defaults are pinned');
  assert.equal(bare.decliningTemp, 'off');

  const kept = toEs1Payload(fromEs1Wire(CUSTOM), preservedFrom(CUSTOM));
  assert.equal(kept.transition, 'fast');
  assert.equal(kept.decliningTemp, 'on');
  assert.equal(kept.adaptive, CUSTOM.adaptive);
});

test('a preserved original never overrides the folder we write into', () => {
  const kept = toEs1Payload(fromEs1Wire(LEVER), preservedFrom(LEVER));
  assert.equal(kept.folder, 'custom', 'a factory original must not drag its folder along');
});

/** Fellow's answer to a payload it will not take: NestJS validation, as on login. */
const REJECTED = {
  message: ['temperature must not be greater than 94', 'title must be shorter than 30 characters'],
  error: 'Bad Request',
  statusCode: 400,
};
const SESSION = { email: 'me@example.com', accessToken: 'tok' };

function fellowAnswers(status: number, body: unknown) {
  return mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify(body), { status }),
  );
}

test("a rejected push carries Fellow's own reasons and its raw answer", async (t) => {
  const fetch = fellowAnswers(400, REJECTED);
  t.after(() => fetch.mock.restore());

  const result = await liveFellowClient.pushProfile(SESSION, 'FS_1', fromEs1Wire(CUSTOM));
  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    'Fellow rejected the profile (400): temperature must not be greater than 94; title must be shorter than 30 characters',
  );
  assert.deepEqual(result.raw, REJECTED);
});

test('a rejected update is explained the same way as a rejected push', async (t) => {
  const fetch = fellowAnswers(400, REJECTED);
  t.after(() => fetch.mock.restore());

  const result = await liveFellowClient.updateProfile(
    SESSION,
    'FS_1',
    CUSTOM.id,
    fromEs1Wire(CUSTOM),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /^Fellow rejected the profile \(400\): temperature must not/);
  assert.deepEqual(result.raw, REJECTED);
});

test('a Fellow that cannot be reached is not reported as a rejection', async (t) => {
  const fetch = mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  t.after(() => fetch.mock.restore());

  const result = await liveFellowClient.pushProfile(SESSION, 'FS_1', fromEs1Wire(CUSTOM));
  assert.equal(result.message, 'Could not reach Fellow: fetch failed');
});

test('every Fellow request is bounded in time', async (t) => {
  const fetch = fellowAnswers(200, []);
  t.after(() => fetch.mock.restore());

  await liveFellowClient.listProfiles(SESSION, 'FS_1');
  const init = fetch.mock.calls[0].arguments[1] as RequestInit;
  assert.ok(init.signal instanceof AbortSignal);
});
