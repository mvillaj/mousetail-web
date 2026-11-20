import { ViewTransition, useEffect, useLayoutEffect, useState } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import {
  BookOpen,
  Bean,
  CloudCog,
  Coffee as CoffeeIcon,
  Compass,
  Cog,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  Palette,
  Sprout,
  Plus,
  UserRound,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NO_MACHINE_CAPABILITIES, type MachineCapabilities } from '@brewlab/shared';
import { useAuth } from './lib/auth';
import { useMachines } from './lib/machines';
import { useDelayPassed } from './lib/delay';
import AuthPage from './pages/Auth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Shots from './pages/Shots';
import Coffees from './pages/Coffees';
import CoffeeDetail from './pages/CoffeeDetail';
import Explore from './pages/Explore';
import Grinders from './pages/Grinders';
import Machines from './pages/Machines';
import Profiles from './pages/Profiles';
import ProfileEditor from './pages/ProfileEditor';
import Fellow from './pages/Fellow';
import Changelog from './pages/Changelog';
import Account from './pages/Account';
import GettingStarted from './pages/GettingStarted';
import BrandLockup from './components/BrandLockup';
import { FinishPicker, ThemeToggle } from './components/Appearance';

interface NavLinkDef {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  show: boolean;
}

export function navFor(caps: MachineCapabilities) {
  const groups: { section: string; links: NavLinkDef[] }[] = [
    {
      section: 'Brewing',
      links: [
        { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true, show: true },
        { to: '/shots', label: 'Shot log', icon: History, show: true },
        { to: '/profiles', label: 'Profiles', icon: Waves, show: caps.profiling !== 'none' },
      ],
    },
    {
      section: 'Equipment',
      links: [
        { to: '/machines', label: 'Machines', icon: CoffeeIcon, show: true },
        { to: '/grinders', label: 'Grinders', icon: Cog, show: true },
      ],
    },
    {
      section: 'Library',
      links: [
        { to: '/coffees', label: 'My coffees', icon: Bean, show: true },
        { to: '/explore', label: 'Explore', icon: Compass, show: true },
      ],
    },
    {
      section: 'Settings',
      links: [
        { to: '/account', label: 'My account', icon: UserRound, show: true },
        { to: '/fellow', label: 'Fellow account', icon: CloudCog, show: caps.cloud === 'fellow' },
      ],
    },
    {
      section: 'About',
      links: [
        { to: '/getting-started', label: 'Getting started', icon: Sprout, show: true },
        { to: '/changelog', label: 'Changelog', icon: BookOpen, show: true },
      ],
    },
  ];
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => l.show) }))
    .filter((g) => g.links.length > 0);
}

function Nav({ groups }: { groups: ReturnType<typeof navFor> }) {
  const { pathname } = useLocation();
  // On a short window the nav scrolls; keep where you are in view.
  // Only the nav's own scroll area moves: scrollIntoView would scroll the page too.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.sidebar .nav');
    const active = nav?.querySelector<HTMLElement>('a.active');
    if (!nav || !active) return;
    const top = active.offsetTop - nav.offsetTop;
    if (top < nav.scrollTop) nav.scrollTop = top;
    else if (top + active.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = top + active.offsetHeight - nav.clientHeight;
    }
  }, [pathname]);
  return (
    <nav className="nav" aria-label="Main">
      {groups.map((group) => (
        <div className="nav-group" key={group.section}>
          <div className="nav-label">{group.section}</div>
          {group.links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <l.icon className="nav-icon" aria-hidden="true" />
              {l.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Account row. On desktop, theme and finish live in a popover off this row, so
 * the footer stays one line and never crowds the nav on a short window. The
 * phone sheet has the room, so it shows them inline.
 */
function Settings({ inline = false }: { inline?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.account')) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const controls = (
    <>
      <h3>Theme</h3>
      <ThemeToggle />
      <h3>Colour</h3>
      <FinishPicker />
    </>
  );

  return (
    <div className="sidebar-foot">
      {inline ? <div className="settings-inline">{controls}</div> : null}
      <div className="account">
        <span className="account-name">{user?.displayName}</span>
        {inline ? null : (
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Theme and colour"
            title="Theme and colour"
          >
            <Palette aria-hidden="true" />
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden="true" />
        </button>
        {open && !inline ? (
          <div className="settings-pop" role="dialog" aria-label="Theme and colour">
            {controls}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Phone navigation: four destinations and Log shot, raised, under the thumb. */
function TabBar({ onMore }: { onMore: () => void }) {
  const navigate = useNavigate();
  const tab = ({ isActive }: { isActive: boolean }) => `tab${isActive ? ' active' : ''}`;
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end className={tab}>
        <LayoutGrid aria-hidden="true" />
        Home
      </NavLink>
      <NavLink to="/shots" className={tab}>
        <History aria-hidden="true" />
        Shots
      </NavLink>
      <button
        type="button"
        className="tab tab-log"
        onClick={() => navigate('/', { state: { log: true } })}
      >
        <span className="tab-log-disc">
          <Plus aria-hidden="true" />
        </span>
        Log shot
      </button>
      <NavLink to="/coffees" className={tab}>
        <Bean aria-hidden="true" />
        Coffees
      </NavLink>
      <button type="button" className="tab" onClick={onMore} aria-haspopup="dialog">
        <Menu aria-hidden="true" />
        More
      </button>
    </nav>
  );
}

/** Destinations the tab bar already carries, so the sheet doesn't repeat them. */
const IN_TAB_BAR = new Set(['/', '/shots', '/coffees']);

export function MoreSheet({
  groups,
  onClose,
}: {
  groups: ReturnType<typeof navFor>;
  onClose: () => void;
}) {
  const location = useLocation();
  const rest = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !IN_TAB_BAR.has(l.to)) }))
    .filter((g) => g.links.length > 0);
  const [opened] = useState(location.key);
  // Any navigation from inside the sheet closes it.
  useEffect(() => {
    if (location.key !== opened) onClose();
  }, [location.key, opened, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Hold the page still underneath, so a drag on the sheet never scrolls it.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, []);
  // Close on click, not mousedown: iOS Safari doesn't fire mouse events for a
  // tap on a plain div, but React gives onClick targets the hook Safari needs.
  return (
    <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="More">
        <div className="sheet-head">
          <h2>More</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="sheet-body">
          <Nav groups={rest} />
          <Settings inline />
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { capabilities } = useMachines();
  const nav = navFor(capabilities);
  const [more, setMore] = useState(false);

  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();

  // Says how each page arrived, for the page transition's CSS: back and
  // forward (popstate) stay still, as native back does. React usually renders
  // those at once anyway, but not always, so this makes it certain. A layout
  // effect, so it's in place before the transition's animations start.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.navigation = navigationType.toLowerCase();
    return () => {
      delete root.dataset.navigation;
    };
  }, [navigationType, key]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup />
        </div>
        <Nav groups={nav} />
        <Settings />
      </aside>

      <header className="topbar">
        <BrandLockup />
      </header>

      <main className="main">
        {/* A new key per path makes following a link a view transition, since
            BrowserRouter updates inside startTransition; the first paint
            isn't one. default="none" leaves updates that keep the page alone.
            The div gives the transition one element to capture, whatever the
            page renders. */}
        <ViewTransition key={pathname} enter="route-enter" exit="route-exit" default="none">
          <div>{children}</div>
        </ViewTransition>
      </main>

      <TabBar onMore={() => setMore(true)} />
      {more ? <MoreSheet groups={nav} onClose={() => setMore(false)} /> : null}
    </div>
  );
}

/**
 * What shows while Clerk and the bench load. For the first moment, just the
 * page's ground. After that, a signed-in user gets the shell's frame with soft
 * bars where the nav and page will land, so the app fills in rather than a
 * status message giving way to it. Before Clerk says who you are there is no
 * telling the landing page from the app, so that stays plain ground.
 *
 * App keeps returning this same element across both waits, so the delay runs
 * from page load, not from each step.
 */
export function Loading({ shell }: { shell: boolean }) {
  const late = useDelayPassed();
  if (!late || !shell) return <div className="boot" aria-busy="true" />;

  // The smallest nav there is, so a richer bench only adds rows when it lands.
  const groups = navFor(NO_MACHINE_CAPABILITIES);
  return (
    <div className="shell shell-loading" aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup />
        </div>
        <div className="nav" aria-hidden="true">
          {groups.map((g) => (
            <div className="nav-group" key={g.section}>
              <span className="skel skel-label" />
              {g.links.map((l) => (
                <span className="skel skel-link" key={l.to} />
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-foot" aria-hidden="true">
          <span className="skel skel-account" />
        </div>
      </aside>

      <header className="topbar">
        <BrandLockup />
      </header>

      <main className="main" aria-hidden="true">
        <div className="page-head">
          <span className="skel skel-title" />
          <span className="skel skel-line" />
        </div>
        <span className="skel skel-card" />
      </main>

      <div className="tabbar" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span className="tab" key={i}>
            <span className="skel skel-dot" />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { user, ready, signedIn } = useAuth();
  const { capabilities, ready: benchReady } = useMachines();
  const { pathname } = useLocation();

  if (!ready || (user && !benchReady)) {
    return <Loading shell={signedIn} />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<AuthPage mode="login" />} />
        <Route path="/sign-up" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // First run: nothing else until getting started is finished or skipped.
  if (user.onboardedAt == null && pathname !== '/getting-started') {
    return <Navigate to="/getting-started" replace />;
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/getting-started" element={<GettingStarted />} />
        <Route path="/shots" element={<Shots />} />
        <Route path="/coffees" element={<Coffees />} />
        <Route path="/coffees/:id" element={<CoffeeDetail />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/grinders" element={<Grinders />} />
        <Route path="/machines" element={<Machines />} />
        {capabilities.profiling !== 'none' ? (
          <>
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/profiles/new" element={<ProfileEditor />} />
            <Route path="/profiles/:id" element={<ProfileEditor />} />
          </>
        ) : null}
        {capabilities.cloud === 'fellow' ? <Route path="/fellow" element={<Fellow />} /> : null}
        <Route path="/account" element={<Account />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
