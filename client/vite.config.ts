/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Shared with index.html, which cannot import it.
const DESCRIPTION =
  'A shot log and dial-in coach for espresso at home, with pressure-profile editing for the Fellow Espresso Series 1.';

/**
 * The exact clerk-js build the installed @clerk/clerk-react asks for. Left to
 * itself the provider loads `clerk-js@5`, which Clerk answers with an uncached
 * redirect to the exact version: a network round trip on every launch before
 * any of the app can draw. Naming the exact version
 * skips the redirect, and that URL is immutable, so the service worker keeps it.
 *
 * Read from the package rather than written down, so upgrading Clerk can never
 * leave the app loading an older clerk-js than the React SDK expects. If the
 * layout of the package changes and it can't be found, the build says so and
 * the provider falls back to its own default.
 */
function clerkJsVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const react = dirname(require.resolve('@clerk/clerk-react/package.json'));
    const runtime = join(
      createRequireFrom(react).resolve('@clerk/shared/package.json'),
      '../dist/runtime',
    );
    for (const file of readdirSync(runtime).filter((f) => /^versionSelector-.*\.mjs$/.test(f))) {
      const match = /packageVersion = "(\d+\.\d+\.\d+)"/.exec(
        readFileSync(join(runtime, file), 'utf8'),
      );
      if (match) return match[1];
    }
  } catch {
    // Fall through to the warning.
  }
  console.warn('[mousetail] Could not find the clerk-js version; Clerk will pick its own.');
  return '';
}

function createRequireFrom(dir: string) {
  return createRequire(join(dir, 'package.json'));
}

/**
 * Preload the latin face of each family. The fonts are only asked for once text
 * that uses them is on screen, and the first text waits on Clerk, so without
 * this the first frame draws in the fallback and swaps. Preloaded, they arrive
 * during that wait. latin-ext is left to load on demand.
 *
 * Build only: the hashed file names exist once Rollup has emitted them, and in
 * dev the fonts load straight from the source tree anyway.
 */
function preloadFonts(): Plugin {
  const FACES = /\/assets\/fonts\/(fraunces|figtree|red-hat-mono)-latin\.woff2$/;
  return {
    name: 'mousetail:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.values(ctx.bundle ?? {}).filter(
          (f) => f.type === 'asset' && f.originalFileNames.some((n) => FACES.test(n)),
        );
        return files.map((f) => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            href: `/${f.fileName}`,
            as: 'font',
            type: 'font/woff2',
            crossorigin: '',
          },
          injectTo: 'head',
        }));
      },
    },
  };
}

export default defineConfig({
  define: { __CLERK_JS_VERSION__: JSON.stringify(clerkJsVersion()) },
  plugins: [
    react(),
    preloadFonts(),
    VitePWA({
      // Prompt, not auto: an update that reloads the page mid-way through a
      // shot form throws the shot away. UpdatePrompt offers the reload instead.
      registerType: 'prompt',
      // Leave dev and Playwright (which runs Vite dev) without a worker, so a
      // stale cached shell can never mask a change you just made.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Mousetail',
        short_name: 'Mousetail',
        description: DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The light crema ground: the theme everyone opens on until they pick.
        background_color: '#f7f3ee',
        theme_color: '#f7f3ee',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        // The landing photo ships as WebP (every size, ~175 kB together) and a
        // JPEG fallback (~670 kB) that only browsers without WebP fetch. Cache
        // the WebP so the splash still has its photo offline; skip the rest.
        globIgnores: ['**/pour-*.jpg'],
        navigateFallback: '/index.html',
        // API responses are per-user and never cached: a signed-out phone must
        // not be able to read back the last account's shots.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // clerk-js and the chunks it loads, from the exact-version path only
            // (see clerkJsVersion). Those files never change, so the cached copy
            // is always right and a launch never waits on downloading them.
            urlPattern: ({ url }) => /^\/npm\/@clerk\/clerk-js@\d+\.\d+\.\d+\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'clerk-js',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  // The server already reads the repo-root .env (--env-file-if-exists=../.env).
  // Point Vite at the same file so VITE_CLERK_PUBLISHABLE_KEY lives beside
  // CLERK_SECRET_KEY instead of in a second env file nobody remembers.
  envDir: '..',
  // @brewlab/shared is a workspace package consumed as TypeScript source, so it
  // must go through Vite's transform rather than the dependency pre-bundler.
  optimizeDeps: { exclude: ['@brewlab/shared'] },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    // The virtual module only exists inside a Vite build; tests get a stand-in
    // that vi.mock can replace.
    alias: {
      'virtual:pwa-register/react': new URL('./src/test/pwa-register.ts', import.meta.url).pathname,
    },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
