import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import AppStatus from './components/AppStatus';
import { AuthProvider } from './lib/auth';
import { MachineProvider } from './lib/machines';
import { ThemeProvider, applyTheme, storedPref } from './lib/theme';
import { AiProvider } from './lib/ai';
import './styles/fonts.css';
import './styles/app.css';

// Before render, not in an effect: React runs child effects before the parent's,
// so a component reading the palette on mount would otherwise read whichever
// theme the stylesheet defaults to. Also kills the flash of the wrong theme.
applyTheme(storedPref());

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Fail loudly and legibly. Without a key ClerkProvider throws from deep inside
 * its own tree, which reads as a blank page and a stack trace about a context
 * that means nothing to whoever just cloned this.
 */
if (!publishableKey) {
  document.getElementById('root')!.innerHTML =
    '<div style="font:14px system-ui;padding:40px;max-width:60ch;margin:0 auto">' +
    '<h1 style="font-size:18px">Missing VITE_CLERK_PUBLISHABLE_KEY</h1>' +
    '<p>Add it to the <code>.env</code> at the repo root, then restart <code>pnpm dev</code>. ' +
    'See <code>.env.example</code>.</p></div>';
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set — see .env.example');
}

/**
 * Clerk inside the router, steering with it. Left to itself Clerk navigates by
 * setting `window.location`, so signing out reloaded the whole page on the way
 * back to the landing.
 */
function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      clerkJSVersion={__CLERK_JS_VERSION__ || undefined}
      afterSignOutUrl="/"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <ThemeProvider>
          <AuthProvider>
            <MachineProvider>
              <AiProvider>
                <App />
                <AppStatus />
              </AiProvider>
            </MachineProvider>
          </AuthProvider>
        </ThemeProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>,
);
