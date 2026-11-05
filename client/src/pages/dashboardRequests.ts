/**
 * What the dashboard loads, kept apart from the page so AuthProvider can start
 * these alongside `/auth/me` without importing the page itself.
 */
export const DASHBOARD = {
  shots: '/shots?limit=200',
  stats: '/shots/meta/stats',
  coffees: '/coffees',
  grinders: '/grinders',
  profiles: '/profiles',
} as const;

export const DASHBOARD_REQUESTS = Object.values(DASHBOARD);
