import type { Es1Profile, FellowDevice } from '@brewlab/shared';
import type { FellowClient, FellowSession, PushResult } from './types';

/**
 * Live client for Fellow's cloud API.
 *
 * Endpoints and headers below come from the reverse-engineered Aiden clients
 * (9b/fellow-aiden, simmerkaer/fellow-aiden-ts). Two things to keep in mind:
 *
 *  1. The User-Agent is load-bearing. The API is a mobile-app backend and is
 *     picky about it — which is also why this has to run server-side rather
 *     than from the browser (no CORS headers, and browsers won't let JS set UA).
 *  2. The espresso line is NOT under /devices/{id}. It sits behind a product
 *     segment taken from the device's own `deviceType` ("Solo"), on the v2
 *     stage: /v2/solo/devices/{id}/profiles. Captured from the iOS app on
 *     2026-08-28. This is why every probe of /v1 and /v2 /devices/FS_... came
 *     back 404 "Device could not be found": the brewer controller genuinely
 *     does not know espresso devices, and the ES1 surfaces only in the shared
 *     GET /devices listing.
 *
 * Nothing here runs for a user until they opt in on the Fellow page.
 */

const API_HOST =
  process.env.FELLOW_API_HOST ?? 'https://l8qtmnc692.execute-api.us-west-2.amazonaws.com';

/** Same discriminator as classifyDevice, for the paths that only receive an id. */
function isEspressoId(deviceId: string): boolean {
  return deviceId.startsWith('FS_');
}

/**
 * Route table. Paths carry their own stage, because the two product lines are
 * not on the same one: the brewer is served from /v1, the espresso machine from
 * /v2 behind a `solo` segment. /v2 also mirrors every /v1 brewer route, so the
 * split is by product, not by version.
 *
 * That segment looks like the lowercased `deviceType` on the device record
 * ("Solo"). If Fellow ships a second espresso model, expect it to get its own
 * segment rather than share this one.
 */
const API = {
  login: '/v1/auth/login',
  devices: '/v1/devices?dataType=real',
  profiles: (deviceId: string) =>
    isEspressoId(deviceId)
      ? `/v2/solo/devices/${deviceId}/profiles`
      : `/v1/devices/${deviceId}/profiles`,
  profile: (deviceId: string, profileId: string) => `${API.profiles(deviceId)}/${profileId}`,
  profileShare: (deviceId: string, profileId: string) =>
    `${API.profiles(deviceId)}/${profileId}/share`,
} as const;
const USER_AGENT = process.env.FELLOW_USER_AGENT ?? 'Fellow/5 CFNetwork/1568.300.101 Darwin/24.2.0';
const RETRY_STATUS = new Set([408, 500, 501, 502, 503, 504]);
/**
 * Per attempt. Four attempts plus backoff stay under Cloudflare's 100 s, past
 * which it answers the browser with an HTML page and our reason is lost.
 */
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
  attempt = 0,
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_HOST}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (RETRY_STATUS.has(res.status) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
    return request<T>(path, init, attempt + 1);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(
      `Fellow API ${res.status} on ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`,
    ) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * The ES1 profile wire format, confirmed against a full GET of the account's
 * profiles and the response to a create, 2026-08-28.
 *
 * The machine does not take a list of typed phases. It takes:
 *   - pre-infusion as four flat fields (enabled + hold pressure + fill flow + duration)
 *   - `infusion[]`, an array of flat {duration, pressure} steps
 *   - ramp-down as three top-level fields, one ramp only
 *
 * A falling pressure curve is expressed as successive flat infusion steps. The
 * factory "Lever" profile is exactly that: six steps, 9 bar down to 4.
 *
 * `folder` partitions the list: "fellow" for the seven factory profiles (ids
 * `1_lightroast` .. `7_turboshot`), "drops" for Fellow's weekly roaster drops
 * (10-char ids, plus notes, imageUrl, blurHash, status), "custom" for the
 * user's own (15-char ids). Only "custom" is ours to write.
 *
 * `version: 16` is identical on every profile in the account, factory ones
 * included -- it is a schema version, not a per-profile counter, and the server
 * sets it. Do not send it.
 */
export interface Es1WireProfile {
  title: string;
  notes: string;
  roasterName?: string | null;
  grindSize: number;
  dose: number;
  ratio: number;
  /** Celsius. Not always a clean 0.5 step -- the machine displays Fahrenheit. */
  temperature: number;
  adaptive: boolean;
  /** "off" | "on" observed. */
  decliningTemp: string;
  /** "smooth" | "fast" observed. */
  transition: string;
  preInfusionEnabled: boolean;
  /** 1-9 bar. */
  preInfusionHoldPressure: number;
  /** 1-6.5 ml/s, 0.1 steps. */
  preInfusionFillFlowRate: number;
  /** 1-120 s. */
  preInfusionDuration: number;
  infusion: { duration: number; pressure: number }[];
  rampDownEnabled: boolean;
  rampDownEndPressure: number | null;
  rampDownDuration: number | null;
  folder: string;
  /** Unix seconds at write time. The device record carries the last one applied. */
  settingsVersion: number;
}

/** Server-managed fields that come back on a read but must not be sent. */
export interface Es1WireProfileRead extends Es1WireProfile {
  id: string;
  /**
   * True on exactly the factory profiles in the captured account. Stronger than
   * `folder`, which Fellow's own data spells inconsistently.
   */
  isDefaultProfile?: boolean;
  synced?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  imageUrl?: string;
}

/**
 * Observed on every captured profile and not yet varied from the app, so held
 * constant. `adaptive` is true on all of Fellow's Drops and false on everything
 * the user made, which hints at a Fellow-authored flag rather than a user control.
 */
const OBSERVED_DEFAULTS = {
  adaptive: false,
  decliningTemp: 'off',
  transition: 'smooth',
} as const;

/** The only folder we are entitled to write into. */
const CUSTOM_FOLDER = 'custom';

/** Captured default. The grind scale itself is still unknown -- see RANGE_NOTES. */
const DEFAULT_GRIND_SIZE = 2;

/**
 * Infusion and ramp-down steps carry no flow field on the wire; only
 * pre-infusion does. This is what we assume when reconstructing a stage from a
 * profile the machine sent us.
 */
const ASSUMED_INFUSION_FLOW_ML_S = 4.5;

/**
 * Fields the ES1 sends that our `Es1Profile` has nowhere to put. Left alone they
 * get re-pinned to OBSERVED_DEFAULTS on every write, which is harmless for a
 * profile authored here and lossy for one imported from the machine -- so an
 * import carries its original wire record and we replay them.
 */
export type PreservedWireFields = Pick<
  Es1WireProfile,
  'adaptive' | 'decliningTemp' | 'transition' | 'roasterName'
>;

export function preservedFrom(
  wire: Es1WireProfileRead | null | undefined,
): PreservedWireFields | null {
  if (!wire) return null;
  return {
    adaptive: wire.adaptive,
    decliningTemp: wire.decliningTemp,
    transition: wire.transition,
    roasterName: wire.roasterName ?? null,
  };
}

export function toEs1Payload(
  profile: Es1Profile,
  preserved?: PreservedWireFields | null,
): Es1WireProfile {
  const preInfusion = profile.stages.find((s) => s.kind === 'preinfusion');
  const rampDown = profile.stages.find((s) => s.kind === 'rampdown');
  const infusion = profile.stages
    .filter((s) => s.kind === 'infusion')
    .map((s) => ({ duration: s.durationS, pressure: s.pressureBar }));

  return {
    title: profile.name,
    notes: profile.description ?? '',
    grindSize: profile.grindSize ?? DEFAULT_GRIND_SIZE,
    dose: profile.doseG,
    ratio: profile.ratio,
    temperature: profile.brewTempC,
    // Sent whether or not pre-infusion is on: the app omits them when disabled
    // and the server fills in 3 bar / 4.5 ml/s / 5 s, which would quietly
    // overwrite what the user configured before switching it off.
    preInfusionEnabled: Boolean(preInfusion),
    // Whole bar: Fellow refuses a fraction. A profile saved before the editor
    // enforced that still goes, rounded, and describePayloadLoss says so.
    preInfusionHoldPressure: preInfusion ? Math.round(preInfusion.pressureBar) : 3,
    preInfusionFillFlowRate: preInfusion?.flowLimitMlS ?? 4.5,
    preInfusionDuration: preInfusion?.durationS ?? 5,
    infusion,
    rampDownEnabled: Boolean(rampDown),
    rampDownEndPressure: rampDown?.endPressureBar ?? null,
    rampDownDuration: rampDown?.durationS ?? null,
    folder: CUSTOM_FOLDER,
    settingsVersion: Math.floor(Date.now() / 1000),
    // Defaults first so a preserved original wins; an authored-here profile has
    // no original and keeps the observed constants.
    ...OBSERVED_DEFAULTS,
    ...(preserved ?? {}),
  };
}

/**
 * Wire profile -> our model. This is what makes the account's real profiles
 * readable in the editor: the seven factory ones, every weekly Drop, and the
 * user's own customs.
 *
 * The ramp-down is reconstructed as a stage that starts at the final infusion
 * pressure and falls to `rampDownEndPressure`, which is what the machine does.
 */
export function fromEs1Wire(wire: Es1WireProfileRead): Es1Profile {
  const stages: Es1Profile['stages'] = [];

  if (wire.preInfusionEnabled) {
    stages.push({
      id: `${wire.id}-pi`,
      kind: 'preinfusion',
      label: 'Pre-infusion',
      durationS: wire.preInfusionDuration,
      pressureBar: wire.preInfusionHoldPressure,
      endPressureBar: wire.preInfusionHoldPressure,
      flowLimitMlS: wire.preInfusionFillFlowRate,
    });
  }

  const steps = Array.isArray(wire.infusion) ? wire.infusion : [];
  steps.forEach((step, i) => {
    stages.push({
      id: `${wire.id}-in${i}`,
      kind: 'infusion',
      label: steps.length > 1 ? `Infusion ${i + 1}` : 'Infusion',
      durationS: step.duration,
      pressureBar: step.pressure,
      endPressureBar: step.pressure,
      flowLimitMlS: ASSUMED_INFUSION_FLOW_ML_S,
    });
  });

  if (wire.rampDownEnabled && wire.rampDownDuration != null && wire.rampDownEndPressure != null) {
    stages.push({
      id: `${wire.id}-rd`,
      kind: 'rampdown',
      label: 'Ramp down',
      durationS: wire.rampDownDuration,
      pressureBar: steps.at(-1)?.pressure ?? wire.rampDownEndPressure,
      endPressureBar: wire.rampDownEndPressure,
      flowLimitMlS: ASSUMED_INFUSION_FLOW_ML_S,
    });
  }

  return {
    id: wire.id,
    name: wire.title,
    description: wire.notes || undefined,
    doseG: wire.dose,
    ratio: wire.ratio,
    brewTempC: wire.temperature,
    grindSize: wire.grindSize,
    stages,
  };
}

/**
 * Where a wire profile came from. Only 'custom' is writable by us.
 *
 * This **fails closed**: an unrecognised or missing folder is treated as
 * factory, i.e. read-only. The previous version returned 'custom' for anything
 * it did not recognise, which is the wrong way round -- being wrong there means
 * writing over a profile we do not own.
 *
 * The comparison is case-insensitive because Fellow's own data is not
 * consistent: the captured account spells the factory folder "Fellow" and has
 * both "drops" and "Drops" on sibling records.
 */
export function profileOrigin(wire: Es1WireProfileRead): 'factory' | 'drop' | 'custom' {
  if (wire.isDefaultProfile === true) return 'factory';
  const folder = String(wire.folder ?? '')
    .trim()
    .toLowerCase();
  if (folder === 'fellow') return 'factory';
  if (folder === 'drops') return 'drop';
  if (folder === CUSTOM_FOLDER) return 'custom';
  return 'factory';
}

/** Only our own profiles may be written in place. */
export function isEditable(wire: Es1WireProfileRead): boolean {
  return profileOrigin(wire) === 'custom';
}

/**
 * What the machine will not receive, in words the UI can show before a push.
 *
 * Shorter than it was: pre-infusion turned out to have a real flow field
 * (`preInfusionFillFlowRate`), so a pre-infusion stage round-trips intact. Only
 * infusion and ramp-down flow ceilings are dropped.
 */
export function describePayloadLoss(profile: Es1Profile): string[] {
  const loss: string[] = [];

  const sloped = profile.stages.filter(
    (s) => s.kind === 'infusion' && s.endPressureBar !== s.pressureBar,
  );
  if (sloped.length) {
    loss.push(
      `${sloped.length} infusion stage(s) slope in pressure. The ES1 takes flat steps, so each is sent at its start pressure — split it into successive flat stages to keep the curve, the way the factory Lever profile does.`,
    );
  }

  if (profile.stages.filter((s) => s.kind === 'rampdown').length > 1) {
    loss.push('The ES1 supports a single ramp-down. Only the first will be sent.');
  }

  if (profile.stages.some((s) => s.kind !== 'preinfusion' && s.flowLimitMlS)) {
    loss.push(
      'Flow ceilings are only settable on pre-infusion. Limits on infusion and ramp-down stages will be ignored.',
    );
  }

  const pi = profile.stages.find((s) => s.kind === 'preinfusion');
  if (pi && !Number.isInteger(pi.pressureBar)) {
    loss.push(
      `Pre-infusion holds ${pi.pressureBar} bar; the machine takes whole bar, so ${Math.round(pi.pressureBar)} is sent.`,
    );
  }
  if (pi && (pi.durationS < 1 || pi.durationS > 120)) {
    loss.push(`Pre-infusion is ${pi.durationS}s; the machine accepts 1-120s.`);
  }
  if (pi && (pi.flowLimitMlS < 1 || pi.flowLimitMlS > 6.5)) {
    loss.push(`Pre-infusion fill flow is ${pi.flowLimitMlS} ml/s; the machine accepts 1-6.5.`);
  }

  return loss;
}

/**
 * Work out what a device actually is.
 *
 * Observed on a real two-device account (the reverse-engineered Aiden clients
 * model none of this — they just take devices[0]):
 *
 *   Aiden   id "FB_…"  sku "EBRWS-NA"  no deviceType   profile ids "p7" / "plocal1"
 *   ES1     id "FS_…"  sku "1SSE-NA"   deviceType "Solo"  profile ids "2_mediumroast"
 *
 * The id prefix is the most reliable discriminator — FB for the brewer line, FS
 * for the espresso series — with sku and deviceType as corroboration. Anything
 * unrecognised is reported as 'unknown' rather than guessed at, so a new Fellow
 * product does not silently get sent an espresso profile.
 */
export function classifyDevice(raw: Record<string, unknown>): {
  family: 'espresso' | 'brewer' | 'unknown';
  model: string;
} {
  const id = String(raw.id ?? '');
  const sku = String(raw.sku ?? '');
  const displayName = String(raw.displayName ?? '');
  const deviceType = String(raw.deviceType ?? '');

  const espressoSignals =
    Number(id.startsWith('FS_')) +
    Number(/^1SSE/i.test(sku)) +
    Number(deviceType === 'Solo') +
    Number(/espresso|series\s*1/i.test(displayName));
  const brewerSignals =
    Number(id.startsWith('FB_')) + Number(/^EBRWS/i.test(sku)) + Number(/aiden/i.test(displayName));

  if (espressoSignals >= 2) return { family: 'espresso', model: 'Espresso Series 1' };
  if (brewerSignals >= 2) return { family: 'brewer', model: 'Aiden' };
  return { family: 'unknown', model: sku || deviceType || 'unknown' };
}

function normaliseDevice(raw: Record<string, unknown>): FellowDevice {
  const { family, model } = classifyDevice(raw);
  return {
    id: String(raw.id),
    displayName: (raw.displayName as string) ?? 'Fellow device',
    model,
    family,
    sku: (raw.sku as string) ?? null,
    serialNumber: (raw.serialNumber as string) ?? null,
    firmware: raw.firmwareVersion as string | undefined,
    activeProfileId: (raw.activeProfileId as string) ?? (raw.ibSelectedProfileId as string) ?? null,
    enabledFlags: Array.isArray(raw.enabledFlags) ? (raw.enabledFlags as string[]) : [],
    isConnected: raw.isConnected === true,
    supportsEspressoProfiles: family === 'espresso',
    // Kept verbatim: this is how you discover the fields nobody has documented.
    raw,
  };
}

/**
 * Turn an API failure into something that says what actually happened.
 *
 * History worth keeping: before the route was captured, a push returned a bare
 * 404 "Device could not be found", and that message sent us hunting for a schema
 * bug that did not exist. The device was simply not addressable under
 * /devices/{id} at all -- the espresso line lives under /v2/solo. Now that the
 * path is right, a 404 means something genuinely changed, and this says so.
 */
function explainFailure(
  err: Error & { status?: number; body?: unknown },
  deviceId: string,
): string {
  const body = err.body as { message?: unknown } | null | undefined;
  if (err.status === undefined) return `Could not reach Fellow: ${err.message}`;
  const deviceMissing =
    err.status === 404 && /device could not be found/i.test(String(body?.message ?? ''));

  if (deviceMissing && isEspressoId(deviceId)) {
    return (
      `Fellow does not recognise ${deviceId} under /v2/solo. That path came from a capture of ` +
      'the iOS app, so a 404 here means the route moved or the device is registered elsewhere. ' +
      'Re-capture before touching the payload.'
    );
  }
  if (deviceMissing) return `Fellow does not recognise device ${deviceId}.`;
  if (err.status === 401) return 'Fellow rejected the session token — reconnect the account.';
  return `Fellow rejected the profile (${err.status}): ${fellowReason(err.body) ?? err.message}`;
}

/**
 * Fellow's own words, when it gave any. Its validation errors are NestJS-shaped:
 * `message` is a list of complaints ("email must be an email"), otherwise a string.
 */
function fellowReason(body: unknown): string | null {
  const message = (body as { message?: unknown } | null | undefined)?.message;
  if (Array.isArray(message) && message.length) return message.map(String).join('; ');
  if (typeof message === 'string' && message) return message;
  return null;
}

export const liveFellowClient: FellowClient = {
  async login(email, password): Promise<FellowSession> {
    // Fellow also returns a refreshToken. It is deliberately dropped on the
    // floor: nothing here ever called a refresh endpoint with it, so persisting
    // it only widened what a leaked database would give away.
    const body = await request<{ accessToken: string }>(API.login, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return { email, accessToken: body.accessToken };
  },

  async listDevices(session) {
    const devices = await request<Record<string, unknown>[]>(API.devices, {
      token: session.accessToken,
    });
    return (Array.isArray(devices) ? devices : []).map(normaliseDevice);
  },

  async listProfiles(session, deviceId) {
    const res = await request<unknown>(API.profiles(deviceId), {
      token: session.accessToken,
    });
    return Array.isArray(res) ? res : [res];
  },

  async updateProfile(session, deviceId, fellowProfileId, profile, preserved): Promise<PushResult> {
    const payload = toEs1Payload(profile, preserved);
    try {
      const updated = await request<Record<string, unknown>>(
        API.profile(deviceId, fellowProfileId),
        { method: 'PATCH', token: session.accessToken, body: JSON.stringify(payload) },
      );
      return {
        ok: true,
        fellowProfileId: String(updated?.id ?? fellowProfileId),
        raw: updated,
        message: `Updated "${profile.name}" on the machine.`,
      };
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      return { ok: false, raw: e.body ?? String(e), message: explainFailure(e, deviceId) };
    }
  },

  async pushProfile(session, deviceId, profile, preserved): Promise<PushResult> {
    const payload = toEs1Payload(profile, preserved);
    try {
      const created = await request<Record<string, unknown>>(API.profiles(deviceId), {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify(payload),
      });
      const fellowProfileId = String(created?.id ?? '');
      let shareLink: string | undefined;
      if (fellowProfileId) {
        try {
          const shared = await request<{ link?: string }>(
            API.profileShare(deviceId, fellowProfileId),
            { method: 'POST', token: session.accessToken },
          );
          shareLink = shared?.link;
        } catch {
          // Sharing is a nicety; a profile that landed is still a win.
        }
      }
      return {
        ok: true,
        fellowProfileId,
        shareLink,
        raw: created,
        message: `Pushed "${profile.name}" to Fellow.`,
      };
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      return {
        ok: false,
        raw: e.body ?? String(e),
        message: explainFailure(e, deviceId),
      };
    }
  },

  async deleteProfile(session, deviceId, fellowProfileId) {
    await request(API.profile(deviceId, fellowProfileId), {
      method: 'DELETE',
      token: session.accessToken,
    });
  },
};
