# Mousetail — ES1 Brew Lab

[![CI](https://github.com/mvillaj/mousetail-web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mvillaj/mousetail-web/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mvillaj/mousetail-web/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/mvillaj/mousetail-web/actions/workflows/codeql.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

An espresso logbook and profile studio for the **Fellow Espresso Series 1**.

**Live:** [mousetail.app](https://mousetail.app)

![Mousetail landing page](docs/images/landing.jpg)

Track every shot with the setting that produced it, compare grind sizes across
grinders that don't agree on what a number means, keep a shared library of
coffees, and build multi-stage pressure profiles you can push to your Fellow
account.

**Stack:** TypeScript end to end · React + Vite SPA · Express on Node 22 with the
built-in `node:sqlite` · zod schemas shared by client and server · Clerk for
auth · Claude for the model-backed features · Fly.io with Litestream backups ·
node:test, Vitest and Playwright, with deploys gated on all three. It runs locally
for development, or as a single container with the API serving the built client.

> **Not affiliated with Fellow.** Mousetail is an independent hobby project. It is not
> affiliated with, endorsed by or supported by Fellow Products, and it talks to
> Fellow's private API, which can change or stop working without notice.

---

## Quick start

Requires **Node 22.9 or newer** (the API uses the built-in `node:sqlite` and
`--env-file-if-exists`, so there is no native module to compile and no dotenv).

Sign-in is handled by [Clerk](https://clerk.com), so this is the one bit of setup
you cannot skip: copy `.env.example` to `.env` and fill in the keys from your
Clerk dashboard (API keys). The API refuses to start without them and the client
refuses to boot.

```bash
cp .env.example .env   # then paste your Clerk keys into it
corepack enable pnpm   # once per machine; picks up the pinned pnpm version
pnpm install
pnpm seed         # demo coffees, profiles and a dial-in in progress
pnpm dev          # API on :4000, app on http://localhost:5173
```

Create an account through the app. The first request you make after signing in
creates your local user row, and a short Getting Started flow asks what machine and
grinders you own. Your bench starts empty rather than assuming an ES1.

The seeded `michael@example.com`, `dana@example.com` and `sam@example.com` are
demo brewers, not accounts: they exist so the Explore page has public profiles to
show you on day one, and there is no password to sign in as them.

```bash
pnpm test         # shared + server (node:test) and client (Vitest)
pnpm test:e2e     # Playwright browser tests (see below)
pnpm typecheck    # tsc across all three packages
pnpm lint         # ESLint
pnpm format       # Prettier (CI runs format:check)
pnpm reset        # wipe the database and re-seed
```

End-to-end tests run the real app in Chromium against a throwaway database
(`server/data/e2e.db`, recreated each run) on ports 4310/5310, so they never touch
a `pnpm dev` you have open. They sign in through your Clerk keys from `.env`, which
must be a **development** instance (`sk_test_`): the first run creates a test user,
`e2e+clerk_test@example.com`. AI features stay disabled during the run. Run
`pnpm exec playwright install chromium` once before the first run. In CI the
same suite runs as the `e2e` job, and deploy waits on it.

---

## What's in it

**Shot log.** Dose, yield, time, pre-infusion, temperature, grind setting,
rating and a sour↔bitter taste slider. Every shot stores the micron equivalent
of its grind setting _at the time it was logged_, so recalibrating a grinder
later never rewrites history.

**Grind normalisation.** The interesting problem. An Opus 2 counts in clicks, a
Niche in numbers, a DF64 in rotations — and none of them mean the same thing.
Each grinder carries an affine model, `microns = intercept + setting × µm-per-unit`,
which lets the app translate a setting from one grinder to another and put every
shot on a comparable axis. Fifteen grinders ship built in; custom ones take four
numbers. Since the shipped figures are community estimates rather than lab
measurements, every grinder can be re-fitted from two reference points you
supply — that's the Calibrate button, and it upgrades a grinder's confidence
from _estimated_ to _measured_.

**Dial-in coach.** After each shot the app suggests the single next change
(finer, coarser, longer, shorter, or hold) from shot time and how it tasted.
One change at a time, because two teaches you nothing.

**Coffee library.** Your own shelf, plus a shared one. Publish a bag and anyone
can browse it on Explore, see how it's been performing, and clone it onto their
own shelf.

**Profile studio.** The ES1 runs a shot as ordered, timed phases; each phase
targets a pressure and the machine modulates flow to hold it. The editor mirrors
what the machine actually lets you build: an optional pre-infusion with its own
duration, hold pressure and fill flow; one or more flat infusion steps of
duration and pressure; and an optional ramp down to an end pressure. A falling
curve is successive steps rather than a slope, which is how the factory Lever
profile is built. Fellow's seven factory profiles ship as starting points, with a
live pressure curve alongside.

**Reading a bag.** Paste a link to the roaster's page — or the copy off the bag —
and the coffee form fills in: name, roaster, origin, varietal, process, roast
level, altitude and tasting notes. It fills the form; you still check it and
press save.

Given a link the server fetches the page itself, which is most of the work. A
shop page is mostly _other coffees_, so `server/src/lib/page-text.ts` drops
navigation, headers, footers and the you-may-also-like rack, and puts the page's
own structured product data first, which turns hundreds of KB of markup into a
couple of KB of text about one coffee. Fetches are restricted to public http(s)
addresses, with every redirect hop re-checked.

Where the text names a place but not its country, the model may complete it, and
any field filled that way is listed back to you as something to check, so you can
tell what came off the page from what came from the model.

**Suggesting a profile.** Any coffee can get a starting shot designed for its
roast, process and altitude. The numbers come from written-down rules
(`packages/shared/src/baseline.ts`), anchored on Fellow's own Light, Medium and Dark
Roast profiles, so the same bag always gets the same baseline. The model only gets
two small nudges for what the rules can't read, such as tasting notes, and the job
of explaining the result. The suggestion opens _unsaved_ in the editor, and is
validated by the same `es1ProfileSchema` as anything you type, so one that breaks
a machine limit is rejected before it reaches you, let alone the machine. Only
offered when your machine actually profiles.

Both model-backed features need Claude credentials (see Environment). Without
them they render disabled with the reason, and the app is otherwise untouched.
Spend is capped per user and per instance each day.

**Install it as an app.** Mousetail is a PWA: _Add to Home Screen_ in Safari
on iOS, or _Install app_ in Chrome and Edge, and it opens full-screen beside
the machine. The app shell is cached, so it opens without a network and says
so; your data is never cached on the device, so logging a shot still needs a
connection. New versions wait for you to tap _Reload_ rather than restarting
mid-shot. The service worker is only built by `pnpm build`, never in `pnpm dev`.
Regenerate the home-screen icons from `client/public/favicon.svg` with
`pnpm --filter @brewlab/client icons`.

---

## The Fellow integration

The app talks to Fellow through one interface, `FellowClient`
(`server/src/fellow/types.ts`), implemented against Fellow's real cloud API in
`server/src/fellow/live.ts`. There is no simulated mode: it was removed because a
real user could not tell its fake ES1 from their own.

**It is opt-in per user.** Every user starts with it off. The Fellow page shows
a warning — experimental, unofficial, private API, writes reach the real machine,
no warranty, at your own risk — and the integration only turns on once they tick
the box and confirm. The server enforces this: every `/api/fellow/*` route except
`status`, `opt-in`, `opt-out` and `disconnect` returns 403 until
`users.fellow_opt_in_at` is set. Turning it off clears that and deletes the
stored token. The token is encrypted at rest with `BREWLAB_ENCRYPTION_KEY`, and
when Fellow expires the session the app asks for the password again.

**How the API was found.** It isn't documented. The device endpoints, base URL and
auth flow started from the reverse-engineered Aiden clients
([9b/fellow-aiden](https://github.com/9b/fellow-aiden),
[simmerkaer/fellow-aiden-ts](https://github.com/simmerkaer/fellow-aiden-ts)); the
espresso routes and the ES1 profile format were captured from the iOS app and a
real account (see the notes at the top of `live.ts`). The API sends no CORS
headers and is picky about its `User-Agent`, which is why these calls go through
the server rather than the browser. `pnpm probe`, `pnpm discover` and `pnpm har`
are the scripts used for that capture work.

---

## Layout

```
packages/shared/    Types, zod schemas, grinder and machine registries, ES1
                    profile model, profile baselines, dial-in heuristics, tests.
                    Imported as source by both sides.
server/             Express + node:sqlite. Auth, CRUD, the Fellow adapter, seed.
client/             Vite + React SPA. Hand-rolled SVG charts, no chart library.
e2e/                Playwright specs, split into signed-in and signed-out.
```

The client and server share one package of types, so a change to the shot model
breaks the build in both places at once — which is the point.
[PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) cover who it's for and how it
should look.

### Changing the schema

The schema lives in `server/migrations/*.sql`, applied in filename order at boot
and recorded in a `schema_migrations` table. To change it, add the next numbered
file, like `009_add_whatever.sql`. Never edit one that has already run; the runner
keys off the filename and will not re-apply it.

`pnpm reset` still wipes and re-seeds, which is the right move locally and
the wrong one anywhere with data you care about.

---

## Environment

Read from a gitignored `.env` at the repo root, or from the environment. See
`.env.example` for the full, commented list; the server reloads it on restart.

| Variable                                                                                    | Default                  | Meaning                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `CLERK_PUBLISHABLE_KEY`                                                                     | _(unset)_                | **Required.** The API verifies session tokens with it                                         |
| `VITE_CLERK_PUBLISHABLE_KEY`                                                                | _(unset)_                | **Required.** Same value; Vite only exposes `VITE_`-prefixed vars to the bundle               |
| `CLERK_SECRET_KEY`                                                                          | _(unset)_                | **Required.** Server only — never let this reach the client                                   |
| `PORT`                                                                                      | `4000`                   | API port                                                                                      |
| `BREWLAB_DB`                                                                                | `server/data/brewlab.db` | SQLite file                                                                                   |
| `BREWLAB_ENCRYPTION_KEY`                                                                    | _(unset)_                | Encrypts the Fellow token at rest. Without it the app runs but connecting Fellow fails        |
| `BREWLAB_ADMIN_EMAILS`                                                                      | _(unset)_                | Comma-separated emails allowed to post changelog entries                                      |
| `CORS_ORIGINS`                                                                              | _(unset)_                | Comma-separated allowlist. Unset: same-origin only in production, `localhost:5173` in dev     |
| `ANTHROPIC_API_KEY`                                                                         | _(unset)_                | Enables the two model-backed features; without it they show disabled                          |
| `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID` | _(unset)_                | On Fly, enable the model features with workload identity federation instead of a key          |
| `AI_USER_DAILY_USD`, `AI_GLOBAL_DAILY_USD`                                                  | `1`, `5`                 | Daily model-spend ceilings per user and per instance, reset at midnight UTC                   |
| `FELLOW_API_HOST`                                                                           | Fellow's AWS endpoint    | Override to go through a proxy                                                                |

#### Model credentials on Fly without a key

In production the server can authenticate to the Claude API with Fly's OIDC
identity instead of a stored `ANTHROPIC_API_KEY`. In the Claude Console, under
**Settings → Workload identity → Connect workload → Custom OIDC**, register:

- issuer `https://oidc.fly.io/<fly-org-slug>` (JWKS discovery)
- a rule matching subject prefix `<fly-org-slug>:es1-brew-lab:*` and audience
  `https://api.anthropic.com` (`FEDERATION_AUDIENCE` in `server/src/lib/fly-oidc.ts`)

Put the rule, organization and service account IDs in `fly.toml`'s `[env]` as
the three `ANTHROPIC_*` variables above, then `fly secrets unset ANTHROPIC_API_KEY`
— a set key always wins over federation. The server mints a fresh Fly token from
`/.fly/api` for every exchange, since Anthropic accepts each token only once.

## Deploying

One Fly machine serves the API and the built SPA, with SQLite on a persistent
volume and Litestream streaming backups to object storage. `Dockerfile`,
`docker-entrypoint.sh` and `fly.toml` are in the repo root:

```bash
fly volumes create brewlab_data --size 1 --region sjc
fly secrets set CLERK_SECRET_KEY=sk_live_... CLERK_PUBLISHABLE_KEY=pk_live_... \
  BREWLAB_ENCRYPTION_KEY="$(openssl rand -base64 32)"
fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

`VITE_CLERK_PUBLISHABLE_KEY` must be a **build arg**, not a `fly secret` — Vite
inlines it into the bundle at build time, so setting it as a secret silently
produces a client that cannot sign anyone in. The same value is _also_ needed as
the runtime secret `CLERK_PUBLISHABLE_KEY`, which the API verifies tokens with.

## Where the numbers come from

Machine limits are Fellow's published figures where they exist: temperature
**50–94 °C**, and a 15-bar pump **calibrated for up to 9 bar of extraction**.
Flow-rate bounds, stage-duration maximum and dose range are _not_ published —
those are inferred from the seven factory profiles and marked as such in
`RANGE_NOTES` (`packages/shared/src/es1.ts`), which the UI surfaces as field
hints. Grinder calibrations are community estimates, tagged `measured`,
`community` or `estimated`, and a conversion is only ever as confident as its
weaker end.

## License

Copyright (C) 2026 Michael Villafuerte. Licensed under the
[GNU Affero General Public License v3.0](LICENSE). If you run a modified version of
this app as a network service, you must offer its users the corresponding source.
Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).
