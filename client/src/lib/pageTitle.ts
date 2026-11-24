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

/** The document title for a path: "Shots | Mousetail", or the home title for "/". */
export function pageTitle(pathname: string): string {
  const page = PAGES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return page ? `${page[1]} | ${SITE}` : HOME_TITLE;
}

export function usePageTitle(pathname: string) {
  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);
}
