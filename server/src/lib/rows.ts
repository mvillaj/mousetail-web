import type {
  BrewProfileRecord,
  ChangelogEntry,
  Coffee,
  Es1Profile,
  Grinder,
  GrinderCalibration,
  GrinderScale,
  Machine,
  MachineCapabilities,
  MachineLimits,
  Process,
  RoastLevel,
  Shot,
} from '@brewlab/shared';
import { jsonCol } from './db';

type Row = Record<string, any>;

/**
 * Read back a row we just wrote.
 *
 * `node:sqlite` types `.get()` as `Row | undefined`, and it is right to — a
 * mismatched id returns nothing. But at the call sites that use this, the row was
 * inserted or updated microseconds earlier on the same connection, so `undefined`
 * means a real bug (wrong id, failed write, rolled-back transaction), not a
 * missing record. Fail loudly and name the thing, rather than passing `undefined`
 * into a mapper that throws "cannot read properties of undefined" one line later.
 */
export function required<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`Expected ${what} to exist immediately after writing it`);
  return row;
}

export const toGrinder = (r: Row): Grinder => ({
  id: r.id,
  userId: r.user_id,
  builtInId: r.built_in_id ?? null,
  name: r.name,
  burrType: r.burr_type ?? null,
  scale: jsonCol<GrinderScale>(r.scale, {
    kind: 'clicks',
    min: 0,
    max: 40,
    step: 1,
    unitLabel: 'clicks',
  }),
  calibration: jsonCol<GrinderCalibration>(r.calibration, {
    umPerUnit: 25,
    interceptUm: 150,
    source: 'estimated',
  }),
  isDefault: Boolean(r.is_default),
  notes: r.notes ?? null,
  createdAt: r.created_at,
});

export const toMachine = (r: Row): Machine => ({
  id: r.id,
  userId: r.user_id,
  builtInId: r.built_in_id ?? null,
  name: r.name,
  capabilities: jsonCol<MachineCapabilities>(r.capabilities, { profiling: 'none', cloud: null }),
  limits: jsonCol<MachineLimits>(r.limits, { tempC: { min: 80, max: 105 }, maxPressureBar: 15 }),
  isDefault: Boolean(r.is_default),
  notes: r.notes ?? null,
  createdAt: r.created_at,
});

export const toCoffee = (r: Row): Coffee => ({
  id: r.id,
  ownerId: r.owner_id,
  ownerName: r.owner_name ?? '',
  name: r.name,
  roaster: r.roaster,
  origin: r.origin ?? null,
  region: r.region ?? null,
  producer: r.producer ?? null,
  varietal: r.varietal ?? null,
  process: (r.process ?? null) as Process | null,
  roastLevel: (r.roast_level ?? null) as RoastLevel | null,
  altitudeMasl: r.altitude_masl ?? null,
  roastDate: r.roast_date ?? null,
  tastingNotes: jsonCol(r.tasting_notes, [] as string[]),
  url: r.url ?? null,
  notes: r.notes ?? null,
  isPublic: Boolean(r.is_public),
  clonedFromId: r.cloned_from_id ?? null,
  createdAt: r.created_at,
  shotCount: r.shot_count ?? undefined,
  avgRating: r.avg_rating ?? null,
  wellRatedShotCount: r.well_rated_count ?? undefined,
  cloneCount: r.clone_count ?? undefined,
});

export const toShot = (r: Row): Shot => ({
  id: r.id,
  userId: r.user_id,
  coffeeId: r.coffee_id ?? null,
  coffeeName: r.coffee_name ?? null,
  grinderId: r.grinder_id ?? null,
  grinderName: r.grinder_name ?? null,
  machineId: r.machine_id ?? null,
  machineName: r.machine_name ?? null,
  profileId: r.profile_id ?? null,
  profileName: r.profile_name ?? null,
  brewedAt: r.brewed_at,
  grindSetting: r.grind_setting ?? null,
  grindMicrons: r.grind_microns ?? null,
  doseG: r.dose_g,
  yieldG: r.yield_g,
  shotTimeS: r.shot_time_s,
  preInfusionS: r.pre_infusion_s ?? null,
  brewTempC: r.brew_temp_c ?? null,
  peakPressureBar: r.peak_pressure_bar ?? null,
  basket: r.basket ?? null,
  wdt: Boolean(r.wdt),
  rating: r.rating ?? null,
  tasteBalance: r.taste_balance ?? null,
  flavourNotes: jsonCol(r.flavour_notes, [] as string[]),
  notes: r.notes ?? null,
  createdAt: r.created_at,
});

export const toProfile = (r: Row): BrewProfileRecord => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  description: r.description ?? null,
  isPublic: Boolean(r.is_public),
  profile: jsonCol<Es1Profile>(r.profile, null as unknown as Es1Profile),
  syncState: r.sync_state,
  origin: (r.origin ?? 'local') as BrewProfileRecord['origin'],
  sourceDeviceId: r.source_device_id ?? null,
  fellowProfileId: r.fellow_profile_id ?? null,
  lastPushedAt: r.last_pushed_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  ownerName: r.owner_name ?? undefined,
});

export const toChangelogEntry = (r: Row): ChangelogEntry => ({
  id: r.id,
  title: r.title,
  version: r.version ?? null,
  publishedOn: r.published_on,
  changes: jsonCol<ChangelogEntry['changes']>(r.changes, []),
  body: r.body ?? '',
  authorName: r.author_name ?? 'Mousetail',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
