import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_REQUESTS } from '../pages/dashboardRequests';
import { clearPrefetched, prefetch } from './api';
import { AuthProvider, useAuth } from './auth';

const signOut = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_clerk_1',
    getToken: async () => 'tok',
    signOut,
  }),
}));

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  prefetch: vi.fn(),
  clearPrefetched: vi.fn(),
}));

const ME = {
  id: 'usr_1',
  displayName: 'Ada Lovelace',
  onboardedAt: '2026-01-01T00:00:00.000Z',
  machines: [],
};

function stubMe(me: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(me), { status: 200 })),
  );
}

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}
const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.mocked(prefetch).mockClear();
  vi.mocked(clearPrefetched).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The dashboard's requests go out alongside /auth/me, but only for an account
// this browser has seen finish getting started: a brand-new one is still being
// provisioned by /auth/me, and is headed for getting started anyway.
describe('AuthProvider prefetch', () => {
  it('starts the dashboard requests for a returning brewer on /', async () => {
    localStorage.setItem('brewlab.onboarded', 'user_clerk_1');
    stubMe(ME);
    renderAuth();
    expect(prefetch).toHaveBeenCalledWith(DASHBOARD_REQUESTS);
    await waitFor(() => expect(auth.ready).toBe(true));
  });

  it('does not for an account it has not seen onboarded', async () => {
    stubMe(ME);
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('does not for a different account than the one remembered', async () => {
    localStorage.setItem('brewlab.onboarded', 'user_someone_else');
    stubMe(ME);
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('does not off the dashboard', async () => {
    localStorage.setItem('brewlab.onboarded', 'user_clerk_1');
    window.history.replaceState(null, '', '/shots');
    stubMe(ME);
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('remembers an onboarded account once /auth/me says so', async () => {
    stubMe(ME);
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    expect(localStorage.getItem('brewlab.onboarded')).toBe('user_clerk_1');
  });

  it('forgets it for an account still to get started', async () => {
    localStorage.setItem('brewlab.onboarded', 'user_clerk_1');
    stubMe({ ...ME, onboardedAt: null });
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    expect(localStorage.getItem('brewlab.onboarded')).toBeNull();
  });

  it('drops prefetched answers and the flag on sign-out', async () => {
    stubMe(ME);
    renderAuth();
    await waitFor(() => expect(auth.ready).toBe(true));
    act(() => auth.logout());
    expect(clearPrefetched).toHaveBeenCalled();
    expect(localStorage.getItem('brewlab.onboarded')).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });
});
