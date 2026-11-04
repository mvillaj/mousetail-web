import { join } from 'node:path';
import express from 'express';
import type { Express } from 'express';

/**
 * Files the installed app re-checks on every launch. A cached service worker
 * or manifest keeps old clients on an old build for as long as the cache
 * lives, so these always revalidate.
 */
const ALWAYS_REVALIDATE = new Set([
  '/sw.js',
  '/registerSW.js',
  '/manifest.webmanifest',
  '/index.html',
]);

/** Paths the SPA fallback must never answer with index.html. */
const NO_FALLBACK = /^\/(api\/|sw\.js$|registerSW\.js$|workbox-[\w-]+\.js$|manifest\.webmanifest$)/;

/**
 * Serve the built SPA. Vite fingerprints everything under /assets, so those
 * can be cached for good; the shell and the service worker cannot.
 */
export function serveClient(app: Express, dist: string) {
  app.use(
    express.static(dist, {
      setHeaders(res, path) {
        const rel = path.slice(dist.length).replaceAll('\\', '/');
        if (rel.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (ALWAYS_REVALIDATE.has(rel)) {
          res.setHeader('Cache-Control', 'no-cache');
        }
        if (rel === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
        }
      },
    }),
  );
  // Deep links like /shots are client-side routes: hand them index.html and let
  // the router sort it out. /api/* and the service worker files are excluded,
  // so a missing worker is a 404 the browser can act on, not a page of HTML it
  // would try to run as script.
  app.use((req, res, next) => {
    if (NO_FALLBACK.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dist, 'index.html'));
  });
}
