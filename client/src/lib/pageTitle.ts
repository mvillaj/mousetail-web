import { useEffect } from 'react';

const SITE = 'Mousetail';
export const HOME_TITLE = `${SITE} - Shot log, dial-in coach and ES1 profiles`;

const PAGES: [prefix: string, title: string][] = [
  ['/sign-in', 'Sign in'],
  ['/sign-up', 'Sign up'],
  ['/getting-started', 'Getting started'],
  ['/shots', 'Shots'],
  ['/coffees', 'Coffees'],
  ['/explore', 'Explore'],
  ['/grinders', 'Grinders'],
  ['/machines', 'Machines'],
  ['/profiles', 'Profiles'],
  ['/fellow', 'Fellow account'],
  ['/account', 'My account'],
  ['/changelog', 'Changelog'],
];

/**
 * The document title for a path: "Shots | Mousetail". "/" is the landing page
 * when signed out (the home title) and the dashboard when signed in.
 */
export function pageTitle(pathname: string, signedIn = false): string {
  if (pathname === '/') return signedIn ? `Dashboard | ${SITE}` : HOME_TITLE;
  const page = PAGES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return page ? `${page[1]} | ${SITE}` : HOME_TITLE;
}

export function usePageTitle(pathname: string, signedIn: boolean) {
  useEffect(() => {
    document.title = pageTitle(pathname, signedIn);
  }, [pathname, signedIn]);
}
