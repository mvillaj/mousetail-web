// Stand-in for vite-plugin-pwa's virtual module under Vitest. Tests that care
// about the update prompt replace it with vi.mock.
import { useState } from 'react';

export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async () => {} };
}
