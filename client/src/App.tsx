import {
  ViewTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
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
  Bean,
  ChevronDown,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react';
import { NO_MACHINE_CAPABILITIES, type MachineCapabilities } from '@brewlab/shared';
import { useAuth } from './lib/auth';
import { useMachines } from './lib/machines';
import { useDelayPassed } from './lib/delay';
import { sidebarStartsOpen, slideProgress, useSidebar } from './lib/sidebar';
import { usePageTitle } from './lib/pageTitle';
import { useScrollEdges } from './lib/useScrollEdges';
import { useScrolling } from './lib/useScrolling';
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
import BrandRing from './components/BrandRing';
import RailLabel from './components/RailLabel';
import * as NavIcons from './components/NavIcons';
import { FinishPicker, ThemeToggle } from './components/Appearance';

interface NavLinkDef {
  to: string;
  label: string;
  icon: NavIcons.NavIcon;
  end?: boolean;
  show: boolean;
}

export function navFor(caps: MachineCapabilities) {
  const groups: { section: string; links: NavLinkDef[] }[] = [
    {
      section: 'Brewing',
      links: [
        { to: '/', label: 'Dashboard', icon: NavIcons.LayoutGrid, end: true, show: true },
        { to: '/shots', label: 'Shot log', icon: NavIcons.History, show: true },
        {
          to: '/profiles',
          label: 'Profiles',
          icon: NavIcons.Waves,
          show: caps.profiling !== 'none',
        },
      ],
    },
    {
      section: 'Equipment',
      links: [
        { to: '/machines', label: 'Machines', icon: NavIcons.Coffee, show: true },
        { to: '/grinders', label: 'Grinders', icon: NavIcons.Cog, show: true },
      ],
    },
    {
      section: 'Library',
      links: [
        { to: '/coffees', label: 'My coffees', icon: NavIcons.Bean, show: true },
        { to: '/explore', label: 'Explore', icon: NavIcons.Compass, show: true },
      ],
    },
    {
      section: 'Settings',
      links: [
        { to: '/account', label: 'My account', icon: NavIcons.UserRound, show: true },
        {
          to: '/fellow',
          label: 'Fellow account',
          icon: NavIcons.CloudCog,
          show: caps.cloud === 'fellow',
        },
      ],
    },
    {
      section: 'About',
      links: [
        { to: '/getting-started', label: 'Getting started', icon: NavIcons.Sprout, show: true },
        { to: '/changelog', label: 'Changelog', icon: NavIcons.BookOpen, show: true },
      ],
    },
  ];
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => l.show) }))
    .filter((g) => g.links.length > 0);
}

/**
 * A sidebar link whose icon plays its move while the link is pointed at or
 * tabbed to: the whole row is the target, not just the 19px icon.
 */
function NavItem({ link, rail }: { link: NavLinkDef; rail: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <NavLink
      to={link.to}
      end={link.end}
      title={rail ? link.label : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      // Keyboard focus only: a click focuses the link too, and the move
      // shouldn't play again on every click.
      onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
    >
      <link.icon className="nav-icon" animate={hovered || focused} />
      <span className="nav-text">{link.label}</span>
    </NavLink>
  );
}

/** How far in from an edge the sidebar's nav fades; .nav-frame in app.css. */
const NAV_FADE = 52;

function Nav({
  groups,
  rail = false,
  ref,
}: {
  groups: ReturnType<typeof navFor>;
  /** Icons only: the names go in tooltips, and stay in the page unseen. */
  rail?: boolean;
  ref?: RefObject<HTMLElement | null>;
}) {
  return (
    <nav className="nav" aria-label="Main" ref={ref}>
      {groups.map((group) => (
        <div className="nav-group" key={group.section}>
          <div className="nav-label">{group.section}</div>
          {group.links.map((l) => (
            <NavItem key={l.to} link={l} rail={rail} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * The sidebar's nav. On a short window it scrolls, and says so: it fades where
 * there's more, with a chevron below that scrolls on. The chevron is for the
 * pointer alone; tabbing through the links already brings each into view. Its
 * scrollbar shows only while someone scrolls it.
 */
function SidebarNav({ groups, rail }: { groups: ReturnType<typeof navFor>; rail: boolean }) {
  const nav = useRef<HTMLElement>(null);
  const { above, below } = useScrollEdges(nav);
  const placedAt = useRef<number | null>(null);
  const scrolling = useScrolling(nav, placedAt);
  const { pathname } = useLocation();

  // On a short window the nav scrolls; keep where you are in view.
  // Only the nav's own scroll area moves: scrollIntoView would scroll the page too.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    let height = el.clientHeight;
    const place = () => {
      const active = el.querySelector<HTMLElement>('a.active');
      if (!active) return;
      // Measured on screen, and clear of the fade at either edge (NAV_FADE).
      const view = el.getBoundingClientRect();
      const row = active.getBoundingClientRect();
      const was = el.scrollTop;
      if (row.top < view.top + NAV_FADE) el.scrollTop -= view.top + NAV_FADE - row.top;
      else if (row.bottom > view.bottom - NAV_FADE) {
        el.scrollTop += row.bottom - view.bottom + NAV_FADE;
      }
      if (el.scrollTop !== was) placedAt.current = el.scrollTop;
    };
    place();

    // A shorter window keeps it too, unless it had been scrolled out of view.
    if (typeof ResizeObserver === 'undefined') return;
    const sized = new ResizeObserver(() => {
      const before = height;
      height = el.clientHeight;
      const active = el.querySelector('a.active');
      if (!active || !height || (before && height >= before)) return;
      const top = active.getBoundingClientRect().top - el.getBoundingClientRect().top;
      // From nothing: the window was too narrow for a sidebar, and now isn't.
      if (!before || (top >= 0 && top < before)) place();
    });
    sized.observe(el);
    return () => sized.disconnect();
  }, [pathname]);

  return (
    <div
      className="nav-frame"
      data-more-above={above || undefined}
      data-more-below={below || undefined}
      data-scrolling={scrolling || undefined}
    >
      <Nav groups={groups} rail={rail} ref={nav} />
      <button
        type="button"
        className="nav-more"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          const el = nav.current;
          if (!el) return;
          const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollBy({ top: el.clientHeight * 0.7, behavior: calm ? 'auto' : 'smooth' });
        }}
      >
        <ChevronDown aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Account row. On desktop, theme and finish live in a popover off this row, so
 * the footer stays one line and never crowds the nav on a short window. In the
 * rail there's room for the initial alone, so it opens the lot: name, theme,
 * finish and sign out. The phone sheet has the room, so it shows them inline.
 */
function Settings({ inline = false, rail = false }: { inline?: boolean; rail?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(!open);
  // Toggling the sidebar shuts it, for good.
  const [openedIn, setOpenedIn] = useState(rail);
  if (openedIn !== rail) {
    setOpenedIn(rail);
    setOpen(false);
  }

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
  const initial = user?.displayName?.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="sidebar-foot">
      {inline ? <div className="settings-inline">{controls}</div> : null}
      <div className="account">
        {inline ? null : rail ? (
          <button
            type="button"
            className="account-initial"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Account"
            title={user?.displayName}
          >
            {initial}
          </button>
        ) : (
          <span className="account-initial" aria-hidden="true">
            {initial}
          </span>
        )}
        {/* Out of sight in the rail, so out of reach too. */}
        <div className="account-line" inert={rail}>
          <span className="account-name">{user?.displayName}</span>
          {inline ? null : (
            <button
              className="btn btn-ghost btn-icon"
              onClick={toggle}
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
        </div>
        {open && !inline ? (
          <div
            className="settings-pop"
            role="dialog"
            aria-label={rail ? 'Account' : 'Theme and colour'}
          >
            {rail ? <div className="settings-name">{user?.displayName}</div> : null}
            {controls}
            {rail ? (
              <button className="btn btn-sm settings-sign-out" onClick={logout}>
                <LogOut aria-hidden="true" />
                Sign out
              </button>
            ) : null}
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

/** How long the sheet takes to leave; keep with .sheet-overlay[data-closing]. */
const SHEET_OUT_MS = 180;

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
  // Closing plays the sheet out before it unmounts. Without it the sheet hung
  // over the next page for the whole page transition, then vanished in a frame.
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    if (!closing) return;
    // Matches the exit in app.css; also covers reduced motion, which has none.
    const t = window.setTimeout(onClose, SHEET_OUT_MS);
    return () => window.clearTimeout(t);
  }, [closing, onClose]);
  // Any navigation from inside the sheet closes it: at the tap (below), so it
  // leaves while the page changes, and here for any that didn't come from it.
  useEffect(() => {
    if (location.key !== opened) close();
  }, [location.key, opened, close]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
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
    <div
      className="sheet-overlay"
      data-closing={closing || undefined}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="More">
        <div className="sheet-head">
          <h2>More</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={close}
            aria-label="Close"
            title="Close"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div
          className="sheet-body"
          onClickCapture={(e) => {
            if ((e.target as Element).closest('.nav a')) close();
          }}
        >
          <Nav groups={rest} />
          <Settings inline />
        </div>
      </div>
    </div>
  );
}

/**
 * The brand slot. The rail shows the ring; open, the ring's drop leaves it and
 * runs along as the word is written behind it, to end as the drop on the tail.
 * All of it is in the stylesheet.
 */
function SidebarBrand() {
  return (
    <div className="brand">
      <BrandRing />
      <BrandLockup />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { capabilities } = useMachines();
  const nav = navFor(capabilities);
  const [more, setMore] = useState(false);

  const sidebar = useSidebar();
  const aside = useRef<HTMLElement>(null);
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

  // A new page starts at the top. The document is what scrolls on a phone, so
  // without this the next page opens part-way down, or jumps once it's shorter
  // than the old offset. Back and forward are left to the browser. A layout
  // effect, so it lands before the transition captures the new page.
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return (
    <div
      className="shell"
      data-sidebar={sidebar.open ? 'open' : 'rail'}
      data-moved={sidebar.slide ? true : undefined}
      data-turned={sidebar.slide?.turned || undefined}
      style={sidebar.slide ? ({ '--slide-from': sidebar.slide.from } as CSSProperties) : undefined}
    >
      <aside className="sidebar" ref={aside}>
        <SidebarBrand />
        <SidebarNav groups={nav} rail={!sidebar.open} />
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => sidebar.toggle(slideProgress(aside.current))}
          title={sidebar.open ? undefined : 'Expand menu'}
        >
          {sidebar.open ? (
            <PanelLeftClose className="nav-icon" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="nav-icon" aria-hidden="true" />
          )}
          <span className="nav-text">{sidebar.open ? 'Collapse menu' : 'Expand menu'}</span>
        </button>
        <Settings rail={!sidebar.open} />
        {sidebar.open ? null : <RailLabel sidebar={aside} />}
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
    <div
      className="shell shell-loading"
      data-sidebar={sidebarStartsOpen() ? 'open' : 'rail'}
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Loading
      </span>
      <aside className="sidebar">
        <SidebarBrand />
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
  usePageTitle(pathname, user != null);

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
