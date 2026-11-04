/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Shared with index.html, which cannot import it.
const DESCRIPTION =
  'A shot log and dial-in coach for espresso at home, with pressure-profile editing for the Fellow Espresso Series 1.';

export default defineConfig({
  plugins: [
    react(),
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
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
