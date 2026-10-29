import { Router } from 'express';
import {
  fellowConnectSchema,
  fellowOptInSchema,
  type FellowConnectionStatus,
} from '@brewlab/shared';
import { db, jsonCol, nowIso } from '../lib/db';
import { requireAuth, type AuthedRequest } from '../lib/auth';
import { UPSTREAM_FAILED } from '../lib/http';
import { decryptSecret, encryptSecret } from '../lib/crypto';
import { fellowOptInGate } from '../lib/fellow-opt-in';
import { fellowConnectLimiter } from '../lib/limits';
import { toProfile } from '../lib/rows';
import { getFellowClient, type FellowSession } from '../fellow/index';
import {
  fromEs1Wire,
  preservedFrom,
  profileOrigin,
  describePayloadLoss,
  type Es1WireProfileRead,
} from '../fellow/live';
import { id } from '../lib/db';

export const fellowRouter: Router = Router();

fellowRouter.use(requireAuth);

function loadConnection(userId: string) {
  const row = db.prepare('SELECT * FROM fellow_connections WHERE user_id = ?').get(userId) as any;
  if (!row) return null;
  let accessToken: string;
  try {
    accessToken = decryptSecret(row.access_token);
  } catch (err) {
    // An undecryptable credential is not recoverable — a missing key, a rotated
    // key, or a row from before encryption. Report it as disconnected so the UI
    // offers the one action that actually helps, rather than 500ing every read.
    console.error('Could not decrypt the stored Fellow token; treating as disconnected.', err);
    return null;
  }
  const session: FellowSession = { email: row.email, accessToken };
  return { row, session, devices: jsonCol(row.devices, [] as any[]) };
}

function optedIn(userId: string): boolean {
  const row = db.prepare('SELECT fellow_opt_in_at FROM users WHERE id = ?').get(userId) as
    { fellow_opt_in_at: string | null } | undefined;
  return Boolean(row?.fellow_opt_in_at);
}

function disconnect(userId: string) {
  db.prepare('DELETE FROM fellow_connections WHERE user_id = ?').run(userId);
}

const WARNING =
  'Writes reach your real machine. ES1 profiles go to /v2/solo/devices/{id}/profiles. ' +
  "Fellow's own factory profiles are read-only here: editing one saves a copy into your " +
  'custom folder rather than overwriting it. Flow limits are only sent for pre-infusion.';

/** Ungated: the page needs it to know whether to show the opt-in at all. */
fellowRouter.get('/status', (req: AuthedRequest, res) => {
  if (!optedIn(req.userId!)) {
    const status: FellowConnectionStatus = { optedIn: false, connected: false, devices: [] };
    res.json(status);
    return;
  }
  const conn = loadConnection(req.userId!);
  const status: FellowConnectionStatus = conn
    ? {
        optedIn: true,
        connected: true,
        email: conn.row.email,
        devices: conn.devices,
        warning: WARNING,
      }
    : { optedIn: true, connected: false, devices: [], warning: WARNING };
  res.json(status);
});

/**
 * The user's acknowledgement that this is experimental, unofficial, and theirs
 * to answer for. The timestamp is the record of it; re-accepting refreshes it.
 */
fellowRouter.post('/opt-in', (req: AuthedRequest, res) => {
  if (!fellowOptInSchema.safeParse(req.body).success) {
    res.status(400).json({ error: 'Tick the box to accept the warning first' });
    return;
  }
  db.prepare('UPDATE users SET fellow_opt_in_at = ? WHERE id = ?').run(nowIso(), req.userId!);
  res.status(204).end();
});

/** Turning it off also drops the stored token: off means nothing is held for Fellow. */
fellowRouter.post('/opt-out', (req: AuthedRequest, res) => {
  db.prepare('UPDATE users SET fellow_opt_in_at = NULL WHERE id = ?').run(req.userId!);
  disconnect(req.userId!);
  res.status(204).end();
});

/** Ungated too: removing a credential should never need permission. */
fellowRouter.post('/disconnect', (req: AuthedRequest, res) => {
  disconnect(req.userId!);
  res.status(204).end();
});

// Everything below talks to Fellow and needs the user's opt-in.
fellowRouter.use(fellowOptInGate(optedIn));

fellowRouter.post('/connect', fellowConnectLimiter, async (req: AuthedRequest, res) => {
  const parsed = fellowConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'A Fellow email and password are required' });
    return;
  }
  const client = getFellowClient();
  try {
    const session = await client.login(parsed.data.email, parsed.data.password);
    const devices = await client.listDevices(session);
    db.prepare(
      `INSERT INTO fellow_connections (user_id, mode, email, access_token, devices, connected_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode, email=excluded.email,
         access_token=excluded.access_token, devices=excluded.devices,
         connected_at=excluded.connected_at`,
    ).run(
      req.userId!,
      'live',
      session.email,
      encryptSecret(session.accessToken),
      JSON.stringify(devices),
      nowIso(),
    );
    const status: FellowConnectionStatus = {
      optedIn: true,
      connected: true,
      email: session.email,
      devices,
      warning: WARNING,
    };
    res.json(status);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

/** Raw device dump — the fastest way to learn what fields the API really returns. */
fellowRouter.get('/devices/:deviceId/profiles', async (req: AuthedRequest, res) => {
  const conn = loadConnection(req.userId!);
  if (!conn) {
    res.status(400).json({ error: 'Connect a Fellow account first' });
    return;
  }
  try {
    res.json(await getFellowClient().listProfiles(conn.session, req.params.deviceId));
  } catch (err) {
    res.status(UPSTREAM_FAILED).json({ error: (err as Error).message });
  }
});

/**
 * The same dump, mapped into something the UI can render: name, where it came
 * from, and whether it is ours to write. The raw variant above stays because it
 * is still the fastest way to see what the API actually returns.
 */
fellowRouter.get('/devices/:deviceId/profiles/parsed', async (req: AuthedRequest, res) => {
  const conn = loadConnection(req.userId!);
  if (!conn) {
    res.status(400).json({ error: 'Connect a Fellow account first' });
    return;
  }
  try {
    const raw = (await getFellowClient().listProfiles(
      conn.session,
      req.params.deviceId,
    )) as Es1WireProfileRead[];
    res.json(
      raw
        .filter((w) => w && typeof w === 'object' && 'id' in w)
        .map((w) => {
          const origin = profileOrigin(w);
          return {
            remoteId: w.id,
            name: w.title,
            origin,
            editable: origin === 'custom',
            profile: fromEs1Wire(w),
          };
        }),
    );
  } catch (err) {
    res.status(UPSTREAM_FAILED).json({ error: (err as Error).message });
  }
});

/** Copy a profile off the machine onto the local shelf, origin intact. */
fellowRouter.post('/import/:deviceId/:remoteId', async (req: AuthedRequest, res) => {
  const conn = loadConnection(req.userId!);
  if (!conn) {
    res.status(400).json({ error: 'Connect a Fellow account first' });
    return;
  }
  let wire: Es1WireProfileRead | undefined;
  try {
    const raw = (await getFellowClient().listProfiles(
      conn.session,
      req.params.deviceId,
    )) as Es1WireProfileRead[];
    wire = raw.find((w) => w && String(w.id) === req.params.remoteId);
  } catch (err) {
    res.status(UPSTREAM_FAILED).json({ error: (err as Error).message });
    return;
  }
  if (!wire) {
    res.status(404).json({ error: 'No such profile on that device' });
    return;
  }

  const origin = profileOrigin(wire);
  const profile = fromEs1Wire(wire);
  const pid = id('prf');
  const now = nowIso();
  db.prepare(
    `INSERT INTO brew_profiles
       (id, user_id, name, description, is_public, profile, sync_state, fellow_profile_id,
        last_pushed_at, origin, source_device_id, source_wire, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, 'pushed', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pid,
    req.userId!,
    profile.name,
    profile.description ?? null,
    JSON.stringify({ ...profile, id: pid }),
    wire.id,
    now,
    origin,
    req.params.deviceId,
    JSON.stringify(wire),
    now,
    now,
  );
  const row = db.prepare('SELECT * FROM brew_profiles WHERE id = ?').get(pid);
  res.status(201).json(toProfile(row as any));
});

fellowRouter.post('/push/:profileId', async (req: AuthedRequest, res) => {
  const conn = loadConnection(req.userId!);
  if (!conn) {
    res.status(400).json({ error: 'Connect a Fellow account first' });
    return;
  }
  const row = db
    .prepare('SELECT * FROM brew_profiles WHERE id = ? AND user_id = ?')
    .get(req.params.profileId, req.userId!) as any;
  if (!row) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  // No silent fallback to devices[0]: on a mixed account that is the Aiden, and
  // aiming an espresso profile at a drip brewer is worse than refusing.
  const target = req.body?.deviceId
    ? conn.devices.find((d: any) => d.id === req.body.deviceId)
    : conn.devices.find((d: any) => d.supportsEspressoProfiles);
  if (!target) {
    res.status(400).json({
      error: req.body?.deviceId
        ? `No device ${req.body.deviceId} on that Fellow account`
        : 'No espresso-capable device on that Fellow account',
    });
    return;
  }
  if (!target.supportsEspressoProfiles) {
    res.status(400).json({
      error: `${target.displayName} is a ${target.model} — it cannot accept an espresso profile.`,
    });
    return;
  }
  const deviceId = target.id;

  const record = toProfile(row);
  const sourceWire = jsonCol<Es1WireProfileRead | null>(row.source_wire, null);
  const preserved = preservedFrom(sourceWire);
  const client = getFellowClient();

  // The one decision that matters. Only a profile we created on the machine is
  // updated in place; a factory or Drop import is always written as a new custom
  // profile, leaving the original untouched.
  const updatable = row.origin === 'custom' && row.fellow_profile_id;
  const result = updatable
    ? await client.updateProfile(
        conn.session,
        deviceId,
        row.fellow_profile_id,
        record.profile,
        preserved,
      )
    : await client.pushProfile(conn.session, deviceId, record.profile, preserved);

  if (result.ok) {
    // A cloned factory profile is now ours: it points at the new remote copy and
    // becomes editable from here on.
    const nextOrigin = updatable ? row.origin : 'custom';
    db.prepare(
      `UPDATE brew_profiles
         SET sync_state='pushed', fellow_profile_id=?, last_pushed_at=?, origin=?, source_device_id=?
       WHERE id=?`,
    ).run(result.fellowProfileId ?? null, nowIso(), nextOrigin, deviceId, record.id);
  } else {
    // The only place Fellow's reason is kept once the response has gone.
    console.warn(`Fellow push failed for ${record.id} on ${deviceId}:`, result.message, result.raw);
  }
  // `error` is what the client's api() surfaces; the rest rides along on the
  // ApiError so the modal can still show Fellow's raw answer and the warnings.
  res.status(result.ok ? 200 : UPSTREAM_FAILED).json({
    ...result,
    ...(result.ok ? {} : { error: result.message }),
    warnings: describePayloadLoss(record.profile),
  });
});
