import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App, { MoreSheet, navFor } from './App';
import { LOADING_DELAY_MS } from './lib/delay';
import { ThemeProvider } from './lib/theme';

let authUser: { displayName: string; onboardedAt: string | null } = {
  displayName: 'Tester',
  onboardedAt: '2026-10-01T00:00:00.000Z',
};

let authReady = true;
let signedIn = true;

vi.mock('./lib/auth', () => ({
  useAuth: () => ({
    user: authReady ? authUser : null,
    ready: authReady,
    signedIn,
    logout: vi.fn(),
  }),
}));

vi.mock('./lib/machines', () => ({
  useMachines: () => ({
    machines: [],
    capabilities: { profiling: 'none', cloud: null },
    ready: true,
  }),
}));

// The routing is under test here, not the pages.
vi.mock('./pages/Dashboard', () => ({ default: () => <h1>Dashboard page</h1> }));
vi.mock('./pages/GettingStarted', () => ({ default: () => <h1>Getting started page</h1> }));

function renderSheet() {
  const onClose = vi.fn();
  const groups = navFor({ profiling: 'pressure', cloud: 'fellow' });
  const { container, unmount } = render(
    <MemoryRouter>
      <ThemeProvider>
        <MoreSheet groups={groups} onClose={onClose} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  const overlay = container.querySelector('.sheet-overlay') as HTMLElement;
  return { onClose, overlay, unmount };
}

describe('MoreSheet', () => {
  // iOS Safari never sends mousedown for a tap on the backdrop, only click.
  it('closes when the backdrop is clicked', async () => {
    const { onClose, overlay } = renderSheet();
    fireEvent.click(overlay);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('stays open when the sheet itself is clicked', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('dialog', { name: 'More' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('closes from its Close button', async () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('plays out before closing, and leaves at the tap on a link', async () => {
    const { onClose, overlay } = renderSheet();
    fireEvent.click(screen.getByRole('link', { name: 'Grinders' }));
    expect(overlay).toHaveAttribute('data-closing');
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('holds the page still while open and releases it on close', () => {
    const { unmount } = renderSheet();
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('navFor', () => {
  const links = (caps: Parameters<typeof navFor>[0]) =>
    navFor(caps).flatMap((g) => g.links.map((l) => l.to));

  it('always offers My account, with or without a Fellow machine', () => {
    expect(links({ profiling: 'none', cloud: null })).toContain('/account');
    expect(links({ profiling: 'pressure', cloud: 'fellow' })).toContain('/account');
  });

  it('lists My account first in Settings, above the Fellow one', () => {
    const account = navFor({ profiling: 'pressure', cloud: 'fellow' }).find(
      (g) => g.section === 'Settings',
    );
    expect(account?.links.map((l) => l.to)).toEqual(['/account', '/fellow']);
  });
});

describe('first-run redirect', () => {
  function Where() {
    return <output data-testid="where">{useLocation().pathname}</output>;
  }

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <App />
          <Where />
        </ThemeProvider>
      </MemoryRouter>,
    );

  it('sends a user who has not finished getting started there first', () => {
    authUser = { displayName: 'New', onboardedAt: null };
    renderAt('/shots');
    expect(screen.getByTestId('where').textContent).toBe('/getting-started');
    expect(screen.getByRole('heading', { name: 'Getting started page' })).toBeTruthy();
  });

  it('leaves an onboarded user where they asked to go', () => {
    authUser = { displayName: 'Old', onboardedAt: '2026-10-01T00:00:00.000Z' };
    renderAt('/');
    expect(screen.getByTestId('where').textContent).toBe('/');
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeTruthy();
  });

  it('keeps getting started reachable from the nav afterwards', () => {
    const links = navFor({ profiling: 'none', cloud: null }).flatMap((g) =>
      g.links.map((l) => l.to),
    );
    expect(links).toContain('/getting-started');
  });
});

// The view transition itself needs a real browser: e2e/signed-in/navigation.spec.ts.
// jsdom has none, so React just swaps pages here, which is what this checks.
describe('page transitions', () => {
  function Back() {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>Back</button>;
  }

  const renderApp = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <App />
          <Link to="/getting-started">Go</Link>
          <Back />
        </ThemeProvider>
      </MemoryRouter>,
    );

  it('swaps the old page for the new one', async () => {
    authUser = { displayName: 'Old', onboardedAt: '2026-10-01T00:00:00.000Z' };
    renderApp();
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Go' }));
    expect(await screen.findByRole('heading', { name: 'Getting started page' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Dashboard page' })).toBeNull();
  });

  it('tells the CSS how each page arrived, so back and forward stay still', async () => {
    authUser = { displayName: 'Old', onboardedAt: '2026-10-01T00:00:00.000Z' };
    const { unmount } = renderApp();
    const navigation = () => document.documentElement.dataset.navigation;

    fireEvent.click(screen.getByRole('link', { name: 'Go' }));
    await screen.findByRole('heading', { name: 'Getting started page' });
    expect(navigation()).toBe('push');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Dashboard page' });
    expect(navigation()).toBe('pop');

    // Signed out, there's no shell, and nothing left for the CSS to read.
    unmount();
    expect(navigation()).toBeUndefined();
  });

  it('starts a new page at the top, and leaves back and forward to the browser', async () => {
    authUser = { displayName: 'Old', onboardedAt: '2026-10-01T00:00:00.000Z' };
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    renderApp();
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Go' }));
    await screen.findByRole('heading', { name: 'Getting started page' });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));

    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Dashboard page' });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('the sidebar', () => {
  afterEach(() => localStorage.clear());
  const renderShell = () => {
    authUser = { displayName: 'Ada', onboardedAt: '2026-10-01T00:00:00.000Z' };
    return render(
      <MemoryRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>,
    );
  };
  const aside = () => screen.getByRole('complementary');

  it('is a rail until opened: icons named in tooltips, the account behind its initial', () => {
    const { container } = renderShell();
    expect(container.querySelector('.shell')).toHaveAttribute('data-sidebar', 'rail');
    expect(within(aside()).getByRole('link', { name: 'Grinders' })).toHaveAttribute(
      'title',
      'Grinders',
    );
    // The row is out of sight, so out of reach.
    expect(container.querySelector('.account-line')).toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    const pop = screen.getByRole('dialog', { name: 'Account' });
    expect(pop).toHaveTextContent('Ada');
    expect(within(pop).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('opens on its button, with labels and the account row in place of tooltips', () => {
    const { container } = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(container.querySelector('.shell')).toHaveAttribute('data-sidebar', 'open');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(aside()).getByRole('link', { name: 'Grinders' })).not.toHaveAttribute('title');
    expect(container.querySelector('.account-line')).not.toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(container.querySelector('.shell')).toHaveAttribute('data-sidebar', 'rail');
    // Shut by the first toggle, so it isn't back with the rail.
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('loading', () => {
  afterEach(() => {
    vi.useRealTimers();
    authReady = true;
    signedIn = true;
  });

  const renderLoading = () =>
    render(
      <MemoryRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>,
    );

  it('shows nothing loading-shaped for a load that finishes quickly', () => {
    vi.useFakeTimers();
    authReady = false;
    const { container } = renderLoading();
    expect(container.querySelector('.boot')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('fills in the shell for a signed-in user once the load runs long', () => {
    vi.useFakeTimers();
    authReady = false;
    const { container } = renderLoading();
    act(() => vi.advanceTimersByTime(LOADING_DELAY_MS));
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(container.querySelector('.shell-loading .sidebar')).toBeTruthy();
    expect(screen.queryByText(/warming up/i)).toBeNull();
  });

  // Before Clerk knows who this is, the visitor may be headed for the landing page.
  it('keeps to the plain ground while it is not yet known who is signed in', () => {
    vi.useFakeTimers();
    authReady = false;
    signedIn = false;
    const { container } = renderLoading();
    act(() => vi.advanceTimersByTime(LOADING_DELAY_MS * 4));
    expect(container.querySelector('.boot')).toBeTruthy();
    expect(container.querySelector('.shell-loading')).toBeNull();
  });
});
