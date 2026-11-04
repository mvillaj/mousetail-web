import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePref = 'light' | 'dark' | 'auto';

const KEY = 'brewlab.theme';
const FINISH_KEY = 'brewlab.finish';

/**
 * A finish is the colour system: its body becomes the one "press me" colour and
 * tints the ground. Mousetail's own orange (Crema orange) is the house finish and the default, so
 * the app stands on its own without anyone owning a particular machine; the rest
 * follow the ES1's body + wood colourways for people who want the app to match
 * theirs. Names describe the colourway only; Mousetail is not affiliated with Fellow.
 * It is a separate axis from light/dark, so the stylesheet keys on data-finish
 * and data-theme together. `body` and `wood` here only paint the picker swatch.
 */
export const FINISHES = [
  { value: 'crema', label: 'Crema orange', body: '#d9622b', wood: '#f4efe9', house: true },
  { value: 'sesame-walnut', label: 'Sesame + Walnut', body: '#e9dcc4', wood: '#6b4428' },
  { value: 'cherry-walnut', label: 'Cherry Red + Walnut', body: '#c4302b', wood: '#6b4428' },
  { value: 'marine-walnut', label: 'Marine Blue + Walnut', body: '#2c5a9a', wood: '#6b4428' },
  { value: 'woodland-walnut', label: 'Woodland + Walnut', body: '#3d6a4b', wood: '#6b4428' },
  { value: 'chocolate-maple', label: 'Malted Chocolate + Maple', body: '#6a4635', wood: '#d9b98c' },
  { value: 'black', label: 'Black', body: '#1f1c1b', wood: '#3a3634' },
] as const;

export const DEFAULT_FINISH = 'crema';

export type Finish = (typeof FINISHES)[number]['value'];

export function storedFinish(): Finish {
  const raw = localStorage.getItem(FINISH_KEY);
  return FINISHES.some((f) => f.value === raw) ? (raw as Finish) : DEFAULT_FINISH;
}

export function applyFinish(finish: Finish) {
  document.documentElement.dataset.finish = finish;
  syncThemeColor();
}

/**
 * Point the browser chrome (and an installed app's status and title bars) at
 * the page's own ground, so they read as one surface in every theme and finish.
 * The palette lives in CSS, so read the colour back rather than duplicating it.
 */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta || !document.body) return;
  const bg = getComputedStyle(document.body).backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return;
  meta.content = bg;
}

export function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Someone who has never picked gets light, the base theme, rather than whatever
 * their OS says: the landing and the app open the same way for everyone until
 * they choose. Choosing "auto" still follows the system from then on.
 */
export function storedPref(): ThemePref {
  const raw = localStorage.getItem(KEY);
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'light';
}

/** The attribute is always concrete, so the stylesheet needs one palette per theme. */
export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = pref === 'auto' ? systemTheme() : pref;
  syncThemeColor();
}

interface ThemeState {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
  finish: Finish;
  setFinish: (f: Finish) => void;
}

const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => storedPref());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    pref === 'auto' ? systemTheme() : pref,
  );

  const [finish, setFinishState] = useState<Finish>(() => storedFinish());

  const setFinish = useCallback((f: Finish) => {
    localStorage.setItem(FINISH_KEY, f);
    setFinishState(f);
    applyFinish(f);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(KEY, p);
    setPrefState(p);
    setResolved(p === 'auto' ? systemTheme() : p);
    applyTheme(p);
  }, []);

  // On "auto", track the OS live rather than only at load.
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      setResolved(systemTheme());
      applyTheme('auto');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const value = useMemo<ThemeState>(
    () => ({ pref, resolved, setPref, finish, setFinish }),
    [pref, resolved, setPref, finish, setFinish],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
