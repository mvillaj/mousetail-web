import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { globalLimiter } from './lib/limits';
import { encryptionConfigured } from './lib/crypto';
import { errorResponse } from './lib/http';
import { serveClient } from './lib/static';
import './lib/db';
import { authRouter } from './routes/auth';
import { changelogRouter } from './routes/changelog';
import { coffeeRouter } from './routes/coffees';
import { fellowRouter } from './routes/fellow';
import { grinderRouter } from './routes/grinders';
import { machineRouter } from './routes/machines';
import { aiRouter } from './routes/ai';
import { profileRouter } from './routes/profiles';
import { shotRouter } from './routes/shots';

const PORT = Number(process.env.PORT ?? 4000);
// Containers need 0.0.0.0; Node's default of localhost is unreachable from
// outside the container and shows up as a health check that never passes.
const HOST = process.env.HOST ?? '0.0.0.0';
const app = express();

// Fly terminates TLS and forwards, so req.ip comes from X-Forwarded-For. `1`
// trusts exactly one hop, not an attacker-supplied chain. The rate limiters key
// on Fly-Client-IP instead (see clientAddress in lib/limits), because that one
// hop is a CDN edge whenever the domain is proxied through one.
app.set('trust proxy', 1);

// An allowlist, not a reflection. In production the SPA is served from this same
// origin, so no CORS headers are needed at all; local dev runs Vite on :5173
// against the API on :4000, which does. CORS_ORIGINS overrides both.
const corsOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins?.length
      ? corsOrigins
      : process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5173'],
  }),
);

app.use(express.json({ limit: '1mb' }));

// Deliberately ahead of clerkMiddleware: a health probe that fails when the
// auth provider is misconfigured cannot tell you the process is up, which is
// the one thing it exists to answer.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, node: process.version });
});

// After /api/health so a flood cannot make the liveness probe fail, which would
// turn a traffic problem into a machine the platform believes is dead. Scoped
// to /api: a single page load fetches a handful of hashed static assets, and
// counting those against the same budget burned it for no protection.
app.use('/api', globalLimiter);

// Reads the session JWT off the Authorization header and attaches the Clerk auth
// object. Must run before any router, including the ones behind optionalAuth.
app.use(clerkMiddleware());

app.use('/api/auth', authRouter);
app.use('/api/grinders', grinderRouter);
app.use('/api/machines', machineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/coffees', coffeeRouter);
app.use('/api/shots', shotRouter);
app.use('/api/profiles', profileRouter);
app.use('/api/fellow', fellowRouter);
app.use('/api/changelog', changelogRouter);

/**
 * Serve the built SPA from the same process as the API. One machine, one origin,
 * no CORS between the two halves and no second thing to deploy — which is the
 * whole reason a single small instance is cheaper than splitting the frontend
 * onto a CDN at this size.
 *
 * Skipped entirely when client/dist is absent, so `pnpm dev` still hands the
 * frontend to Vite rather than serving a stale build.
 */
const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = process.env.BREWLAB_CLIENT_DIST ?? resolve(here, '../../client/dist');

if (existsSync(CLIENT_DIST)) serveClient(app, CLIENT_DIST);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const { status, body } = errorResponse(err);
  res.status(status).json(body);
});

// Warn rather than refuse to boot: only the Fellow flow needs this, and taking
// the whole app down over a feature some deployments never touch is worse than
// failing that one route with a message that says what to do.
if (!encryptionConfigured()) {
  console.warn(
    '  ⚠  BREWLAB_ENCRYPTION_KEY is not set. Connecting a Fellow account will fail\n' +
      '     until it is. Generate one with `openssl rand -base64 32`.',
  );
}

app.listen(PORT, HOST, () => {
  console.log(`  API      http://localhost:${PORT}`);
});
