import type { Es1Profile } from './es1.ts';
import type { GrinderCalibration, GrinderScale } from './grinders.ts';
import type { MachineCapabilities, MachineLimits } from './machines.ts';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  /** May write changelog entries. Set by BREWLAB_ADMIN_EMAILS on the server. */
  isAdmin: boolean;
  /** When getting started was finished or skipped. Null sends the user there first. */
  onboardedAt: string | null;
}

/**
 * What `GET /auth/me` returns: the profile plus the bench. The client needs
 * both before it can draw the shell, so they travel in one round trip.
 */
export interface Me extends PublicUser {
  machines: Machine[];
}

export interface Grinder {
  id: string;
  userId: string;
  builtInId: string | null;
  name: string;
  burrType: string | null;
  scale: GrinderScale;
  calibration: GrinderCalibration;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
}

export interface Machine {
  id: string;
  userId: string;
  builtInId: string | null;
  name: string;
  capabilities: MachineCapabilities;
  limits: MachineLimits;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
}

export type RoastLevel = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';
export type Process = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'experimental' | 'other';

export interface Coffee {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  roaster: string;
  origin: string | null;
  region: string | null;
  producer: string | null;
  varietal: string | null;
  process: Process | null;
  roastLevel: RoastLevel | null;
  altitudeMasl: number | null;
  roastDate: string | null;
  tastingNotes: string[];
  url: string | null;
  notes: string | null;
  isPublic: boolean;
  clonedFromId: string | null;
  createdAt: string;
  /** Aggregates, present on list/detail reads. */
  shotCount?: number;
  avgRating?: number | null;
  /** Shots rated DIALED_IN_MIN_RATING or higher; see isDialedIn. */
  wellRatedShotCount?: number;
  cloneCount?: number;
}

export interface Shot {
  id: string;
  userId: string;
  coffeeId: string | null;
  coffeeName?: string | null;
  grinderId: string | null;
  grinderName?: string | null;
  machineId: string | null;
  machineName?: string | null;
  profileId: string | null;
  profileName?: string | null;
  brewedAt: string;
  grindSetting: number | null;
  grindMicrons: number | null;
  doseG: number;
  yieldG: number;
  shotTimeS: number;
  preInfusionS: number | null;
  brewTempC: number | null;
  peakPressureBar: number | null;
  basket: string | null;
  wdt: boolean;
  rating: number | null;
  /** -2 sour … 0 balanced … +2 bitter */
  tasteBalance: number | null;
  flavourNotes: string[];
  notes: string | null;
  createdAt: string;
}

export type ProfileOrigin = 'local' | 'factory' | 'drop' | 'custom';

export interface BrewProfileRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  profile: Es1Profile;
  syncState: 'local' | 'pushed' | 'stale';
  fellowProfileId: string | null;
  lastPushedAt: string | null;
  /**
   * 'local' is authored here. The rest came off a machine: only 'custom' is
   * ours to write back, and the editor clones the others instead.
   */
  origin: ProfileOrigin;
  sourceDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  ownerName?: string;
}

/**
 * Fellow product families, distinguished by the device-id prefix the API uses:
 * FS_ for the espresso series, FB_ for the brewer line.
 */
export type FellowFamily = 'espresso' | 'brewer' | 'unknown';

export interface FellowDevice {
  id: string;
  displayName: string;
  model: string;
  family: FellowFamily;
  sku?: string | null;
  serialNumber?: string | null;
  firmware?: string;
  /** ES1 reports `activeProfileId` (e.g. "2_mediumroast"); Aiden `ibSelectedProfileId` ("plocal1"). */
  activeProfileId?: string | null;
  enabledFlags?: string[];
  isConnected?: boolean;
  supportsEspressoProfiles: boolean;
  raw?: Record<string, unknown>;
}

export interface FellowConnectionStatus {
  /**
   * Whether this user has accepted the experimental-feature warning. Until they
   * have, nothing else on the Fellow surface is reachable.
   */
  optedIn: boolean;
  connected: boolean;
  /**
   * Connected, but Fellow has stopped accepting the stored token. The email and
   * devices are kept, so the page can ask for the password alone.
   */
  expired?: boolean;
  email?: string;
  devices: FellowDevice[];
  warning?: string;
}

/**
 * The `code` on a Fellow route's error when Fellow refused the stored token.
 * The client keys off this, not the message, to offer the sign-in again.
 */
export const FELLOW_SESSION_EXPIRED = 'fellow_session_expired';

export type ChangeKind = 'new' | 'improved' | 'fixed';

export interface ChangelogEntry {
  id: string;
  title: string;
  version: string | null;
  /** YYYY-MM-DD — the date the update is filed under, not when the row was written. */
  publishedOn: string;
  changes: { kind: ChangeKind; text: string }[];
  /** Free-form write-up. Blank lines separate paragraphs. */
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}
