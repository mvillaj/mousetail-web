import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate with `pnpm --filter @brewlab/client icons` after changing the
// favicon. The PNGs are committed, so builds never need sharp.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The mark already sits on its own dark tile; pad the maskable and Apple
    // icons onto the same ground so launchers that crop to a circle keep it whole.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#2E1B0F' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#2E1B0F' } },
  },
  images: ['public/favicon.svg'],
});
