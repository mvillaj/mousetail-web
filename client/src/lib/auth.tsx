import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import type { Machine, Me, PublicUser } from '@brewlab/shared';
import { DASHBOARD_REQUESTS } from '../pages/dashboardRequests';
import { api, clearPrefetched, prefetch, setTokenGetter } from './api';

/**
 * The Clerk user this browser last saw finish getting started. Only an id, no
 * data: it says the local account already exists, so the dashboard's requests
 * can go out alongside `/auth/me` without racing its first-sight provisioning,
 * and that `/` will show the dashboard rather than send them to getting started.
 */
const ONBOARDED_KEY = 'brewlab.onboarded';

function wasOnboarded(clerkUserId: string): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === clerkUserId;
  } catch {
    return false;
  }
}

function rememberOnboarded(clerkUserId: string | null) {
  try {
    if (clerkUserId) localStorage.setItem(ONBOARDED_KEY, clerkUserId);
    else localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // Private mode or blocked storage: the dashboard just loads after /auth/me.
  }
}

interface AuthState {
  /** The local profile row, not the Clerk one — routes key off `users.id`. */
  user: PublicUser | null;
  ready: boolean;
  /** Clerk has a session, whether or not `/auth/me` has answered yet. */
  signedIn: boolean;
  /**
   * The bench as `/auth/me` returned it, so MachineProvider can start from it
   * instead of asking again. Null until then, and after sign-out.
   */
  initialMachines: Machine[] | null;
  logout: () => void;
  /** Swap in the profile the server returned after an account change. */
  setUser: (user: PublicUser) => void;
  /** Getting started is done or skipped; stop sending them there. */
  markOnboarded: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/**
 * Bridges Clerk's session into the shape the app already speaks. Clerk answers
 * "who is signed in"; `/auth/me` answers "which local bench is theirs", and
 * calling it is also what provisions that bench the first time.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId: clerkUserId, getToken, signOut } = useClerkAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [initialMachines, setInitialMachines] = useState<Machine[] | null>(null);
  const [ready, setReady] = useState(false);

  // Registered during render rather than in an effect on purpose: React runs
  // child effects before the parent's, so MachineProvider's first fetch would
  // otherwise go out before the getter existed and get a 401.
  setTokenGetter(getToken);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      clearPrefetched();
      setUser(null);
      setInitialMachines(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    if (clerkUserId && window.location.pathname === '/' && wasOnboarded(clerkUserId)) {
      prefetch(DASHBOARD_REQUESTS);
    }
    api<Me>('/auth/me')
      .then(({ machines, ...u }) => {
        if (cancelled) return;
        rememberOnboarded(u.onboardedAt != null ? (clerkUserId ?? null) : null);
        setInitialMachines(machines);
        setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, clerkUserId]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      signedIn: Boolean(isLoaded && isSignedIn),
      initialMachines,
      logout: () => {
        setUser(null);
        setInitialMachines(null);
        clearPrefetched();
        rememberOnboarded(null);
        void signOut();
      },
      setUser,
      markOnboarded: async () => {
        setUser(await api<PublicUser>('/auth/me/onboarded', { method: 'POST' }));
        rememberOnboarded(clerkUserId ?? null);
      },
    }),
    [user, ready, isLoaded, isSignedIn, clerkUserId, initialMachines, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
