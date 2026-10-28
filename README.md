# Mousetail — ES1 Brew Lab

[![CI](https://github.com/mvillaj/mousetail-web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mvillaj/mousetail-web/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mvillaj/mousetail-web/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/mvillaj/mousetail-web/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An espresso logbook and profile studio for the **Fellow Espresso Series 1**.

**Live:** [mousetail.app](https://mousetail.app)

![Mousetail landing page: "Bitter? Sour? Chase the mouse tail." over a full-screen photo of an espresso pour](docs/images/landing.jpg)

Track every shot with the setting that produced it, compare grind sizes across
grinders that don't agree on what a number means, keep a shared library of
coffees, and build multi-stage pressure profiles you can push to your Fellow
account.

**Stack:** TypeScript end to end · React + Vite · Express on Node 22 with the
built-in `node:sqlite` · zod schemas shared by client and server · Clerk for
auth · Claude for the model-backed features · Fly.io with Litestream backups ·
node:test, Vitest and Playwright, with deploys gated on all three.

React SPA + a small Node API + SQLite. Runs locally for development, or as a
single container with the API serving the built client — see Deploying below.

> **Not affiliated with Fellow.** Mousetail is an independent hobby project. It is not
> affiliated with, endorsed by or supported by Fellow Products, and it talks to
> Fellow's private API, which can change or stop working without notice.

---

## Quick start

Requires **Node 22.9 or newer** (the API uses the built-in `node:sqlite` and
`--env-file-if-exists`, so there is no native module to compile and no dotenv).

Sign-in is handled by [Clerk](https://clerk.com), so this is the one bit of setup
you cannot skip: copy `.env.example` to `.env` and fill in the two keys from your
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
provisions your bench — a local user row, a default Opus 2 and a default ES1.

The seeded `michael@example.com`, `dana@example.com` and `sam@example.com` are
demo brewers, not accounts: they exist so the Explore page has public profiles to
show you on day one, and there is no password to sign in as them.

```bash
pnpm test         # shared + server (node:test) and client (Vitest)
pnpm --filter @brewlab/client test:watch   # client tests in watch mode
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
of its grind setting *at the time it was logged*, so recalibrating a grinder
later never rewrites history.

**Grind normalisation.** The interesting problem. An Opus 2 counts in clicks, a
Niche in numbers, a DF64 in rotations — and none of them mean the same thing.
Each grinder carries an affine model, `microns = intercept + setting × µm-per-unit`,
which lets the app translate a setting from one grinder to another and put every
shot on a comparable axis. Fifteen grinders ship built in; custom ones take four
numbers. Since the shipped figures are community estimates rather than lab
measurements, every grinder can be re-fitted from two reference points you
supply — that's the Calibrate button, and it upgrades a grinder's confidence
from *estimated* to *measured*.

**Coffee library.** Your own shelf, plus a shared one. Publish a bag and anyone
can browse it, see how it's been performing, and clone it onto their own shelf.

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
shop page is mostly *other coffees*: the page this was built against mentions
Colombia 205 times, every one of them a nav link or a recommendation for a
different bag, while the coffee itself is only ever labelled "San Adolfo". So
`server/src/lib/page-text.ts` drops navigation, headers, footers and the
you-may-also-like rack, and puts the page's own structured product data first —
666 KB of markup becomes about 2.5 KB of text with no other coffee in it. Fetches
are restricted to public http(s) addresses, with every redirect hop re-checked.

Where the text names a place but not its country, it may complete it — San Adolfo
is in Huila — and any field filled that way is listed back to you as something to
check, so you can tell what came off the page from what came from the model.

**Suggesting a profile.** Any coffee can be handed to the model for a starting
shot, designed against that coffee's density, process and roast rather than a
factory default, with a sentence or two on why. It opens *unsaved* in the editor,
and is validated by the same `es1ProfileSchema` as anything you type — a
suggestion that breaks a machine limit is rejected before it reaches you, let
alone the machine. Only offered when your machine actually profiles.

Both need `ANTHROPIC_API_KEY`. Without it they render disabled with the reason,
and the app is otherwise untouched — it still needs no secrets to run.

**Dial-in coach.** After each shot the app suggests the single next change
(finer, coarser, longer, shorter, or hold) from shot time and how it tasted.
One change at a time, because two teaches you nothing.

---

## The Fellow integration

The app talks to Fellow through one interface, `FellowClient`
(`server/src/fellow/types.ts`), implemented against Fellow's real cloud API in
`server/src/fellow/live.ts`. There is no simulated mode any more: it was
removed because a real user could not tell its fake ES1 from their own.

**It is opt-in per user.** Every user starts with it off. The Fellow page shows
a warning — experimental, unofficial, private API, writes reach the real machine,
no warranty, at your own risk — and the integration only turns on once they tick
the box and confirm. The server enforces this: every `/api/fellow/*` route except
`status`, `opt-in`, `opt-out` and `disconnect` returns 403 until
`users.fellow_opt_in_at` is set. Turning it off clears that and deletes the
stored token.

The endpoints, base URL and auth flow started from the reverse-engineered Aiden
clients ([9b/fellow-aiden](https://github.com/9b/fellow-aiden),
[simmerkaer/fellow-aiden-ts](https://github.com/simmerkaer/fellow-aiden-ts)), and
the espresso routes were captured from the iOS app — see the notes at the top of
`live.ts`. The API sends no CORS headers and is picky about its `User-Agent`,
which is why these calls go through the server rather than the browser. The
access token is encrypted at rest with `BREWLAB_ENCRYPTION_KEY`.

---

## Layout

```
packages/shared/    Types, zod schemas, grinder and machine registries, ES1
                    profile model, dial-in heuristics, tests. Imported as
                    source by both sides.
server/             Express + node:sqlite. Auth, CRUD, the Fellow adapter, seed.
client/             Vite + React SPA. Hand-rolled SVG charts, no chart library.
```

The client and server share one package of types, so a change to the shot model
breaks the build in both places at once — which is the point.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `BREWLAB_DB` | `server/data/brewlab.db` | SQLite file |
| `CLERK_PUBLISHABLE_KEY` | *(unset)* | **Required.** The API verifies session tokens with it |
| `VITE_CLERK_PUBLISHABLE_KEY` | *(unset)* | **Required.** Same value; Vite only exposes `VITE_`-prefixed vars to the bundle |
| `CLERK_SECRET_KEY` | *(unset)* | **Required.** Server only — never let this reach the client |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables the two model-backed features; without it they show disabled |
| `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID` | *(unset)* | On Fly, enable the model features with workload identity federation instead of a key (see below) |

These are read from a gitignored `.env` at the repo root if you make one — see
`.env.example` — or from the environment. The server reloads it on restart.

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
| `FELLOW_API_HOST` | AWS endpoint | Override for a proxy |

---

### Changing the schema

The schema lives in `server/migrations/*.sql`, applied in filename order at boot
and recorded in a `schema_migrations` table. To change it, add the next numbered
file — `002_add_whatever.sql`. Never edit one that has already run; the runner
keys off the filename and will not re-apply it.

`pnpm reset` still wipes and re-seeds, which is the right move locally and
the wrong one anywhere with data you care about.

## Deploying

One Fly machine serves the API and the built SPA, with SQLite on a persistent
volume and Litestream streaming backups to object storage. `Dockerfile`,
`docker-entrypoint.sh` and `fly.toml` are in the repo root:

```bash
fly volumes create brewlab_data --size 1 --region sjc
fly secrets set CLERK_SECRET_KEY=sk_live_... CLERK_PUBLISHABLE_KEY=pk_live_...
fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

`VITE_CLERK_PUBLISHABLE_KEY` must be a **build arg**, not a `fly secret` — Vite
inlines it into the bundle at build time, so setting it as a secret silently
produces a client that cannot sign anyone in. The same value is *also* needed as
the runtime secret `CLERK_PUBLISHABLE_KEY`, which the API verifies tokens with.

## Where the numbers come from

Machine limits are Fellow's published figures where they exist: temperature
**50–94 °C**, and a 15-bar pump **calibrated for up to 9 bar of extraction**.
Flow-rate bounds, stage-duration maximum and dose range are *not* published —
those are inferred from the seven factory profiles and marked as such in
`RANGE_NOTES` (`packages/shared/src/es1.ts`), which the UI surfaces as field
hints. Grinder calibrations are community estimates, tagged `measured`,
`community` or `estimated`, and a conversion is only ever as confident as its
weaker end.

## FAQ

### How did you get the Fellow API? Is it documented?

No. The device endpoints came from two open-source Aiden clients; the ES1 profile format was captured from a real account.