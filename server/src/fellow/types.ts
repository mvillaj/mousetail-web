import type { PreservedWireFields } from './live';
import type { Es1Profile, FellowDevice } from '@brewlab/shared';

export interface FellowSession {
  email: string;
  accessToken: string;
}

export interface PushResult {
  ok: boolean;
  fellowProfileId?: string;
  shareLink?: string;
  /** Raw response body, surfaced in the UI so you can see exactly what Fellow returned. */
  raw?: unknown;
  message: string;
  /** Fellow refused the session token (401): the user has to sign in again. */
  sessionExpired?: boolean;
}

/**
 * Everything the app needs from Fellow, behind one seam.
 *
 * The one implementation, `live`, talks to Fellow's private cloud API, found by
 * reverse-engineering the app (see live.ts). It is not public and can change
 * without notice, which is why the whole integration is opt-in per user.
 */
export interface FellowClient {
  login(email: string, password: string): Promise<FellowSession>;
  listDevices(session: FellowSession): Promise<FellowDevice[]>;
  listProfiles(session: FellowSession, deviceId: string): Promise<unknown[]>;
  /** Creates a new profile. Always lands in the custom folder. */
  pushProfile(
    session: FellowSession,
    deviceId: string,
    profile: Es1Profile,
    preserved?: PreservedWireFields | null,
  ): Promise<PushResult>;
  /**
   * Updates an existing profile in place. Callers must have established that the
   * target is ours to write -- see `profileOrigin`.
   */
  updateProfile(
    session: FellowSession,
    deviceId: string,
    fellowProfileId: string,
    profile: Es1Profile,
    preserved?: PreservedWireFields | null,
  ): Promise<PushResult>;
  deleteProfile(session: FellowSession, deviceId: string, fellowProfileId: string): Promise<void>;
}
