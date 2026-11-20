import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearCache } from '../lib/api';

// Vitest runs without globals, so Testing Library cannot register its own
// automatic cleanup. Unmount between tests here instead.
afterEach(cleanup);
// The api module remembers answers for the session; each test is a new one.
afterEach(() => clearCache());
