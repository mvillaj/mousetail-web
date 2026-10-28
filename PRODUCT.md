# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner, at their own espresso bench with a Fellow Espresso Series 1, dialing in coffees and building pressure profiles. The live instance (`es1-brew-lab.fly.dev`) is single-user today.

Likely future audience: other ES1 owners. The Explore page and shared coffee library already assume more than one brewer, but public sign-up is not yet the goal (sign-ups are meant to be restricted to the owner for now). Design should not block a second brewer, and should not assume a crowd.

## Product Purpose

Mousetail is an espresso logbook and profile studio for the Fellow ES1. It records every shot with the setting that produced it, puts shots from grinders that disagree about what a number means on one comparable axis, keeps a personal and shared coffee library, and builds multi-stage pressure profiles that can be pushed to a Fellow account.

Success is a coffee dialed in faster and with less guesswork: log a shot, get the single next change, repeat until it tastes right.

## Positioning

- **One change at a time.** The dial-in coach suggests exactly one next adjustment (finer, coarser, longer, shorter, or hold) from shot time and taste, because two changes teach nothing.
- **Grind normalisation.** Each grinder carries an affine model (`microns = intercept + setting × µm-per-unit`), so a setting translates between grinders and every shot sits on a micron axis. Shots store the micron value at log time, so recalibration never rewrites history. Grinders can be re-fitted from two reference points, upgrading confidence from *estimated* to *measured*.
- **A profile editor that mirrors the machine.** The editor builds only what the ES1 can run: optional pre-infusion, flat infusion steps, optional ramp down. Everything is validated by the same schema before it can reach the machine.
- **Honest about what is known.** Confidence (`measured`, `community`, `estimated`), inferred machine limits, and model-filled fields are surfaced as such, never presented as fact.

## Operating Context

Used across three scenes, all real:

- **Phone at the machine:** logging a shot mid-workflow, between pulls, possibly with wet or busy hands.
- **Tablet propped on the counter** near the machine.
- **Desktop/laptop:** building profiles, comparing grinders, reviewing shot history.

Core workflow: pick a coffee → pull a shot → log dose, yield, time, pre-infusion, temperature, grind setting, rating, and a sour↔bitter taste slider → read the coach's next change → pull again.

Adjacent workflows: reading a bag (paste a roaster URL or bag copy to prefill the coffee form, which the user still checks and saves); asking the model for a starting profile for a coffee (opens unsaved in the editor); importing profiles from the Fellow account; publishing or cloning coffees in the shared library.

## Capabilities and Constraints

- **Stack:** Vite + React SPA, Express + `node:sqlite` API, shared TypeScript/zod package. Hand-rolled SVG charts, no chart library. Clerk for sign-in. One Fly machine serves API and built client.
- **Routes:** Dashboard, Shots, Coffees (+ detail), Explore, Grinders, Machines, Profiles (+ editor, only when the machine profiles), Fellow (only when the cloud is Fellow).
- **Fellow integration:** unofficial, reverse-engineered private API, off until each user opts in past an experimental-feature warning. Fellow's own profiles (factory, Drops, unrecognised folders) are never written to; only profiles positively identified as the user's are updated in place. The editor says so before a push.
- **Model features** (bag reading, profile suggestion) need `ANTHROPIC_API_KEY`; without it they render disabled with the reason, and the rest of the app is untouched.
- **Machine limits:** temperature 50–94 °C and up to 9 bar extraction are Fellow's published figures. Flow bounds, stage-duration max, and dose range are inferred from factory profiles and surfaced as field hints (`RANGE_NOTES` in `packages/shared/src/es1.ts`).
- **Terminology:** shot, dose, yield, pre-infusion, grind setting, bench, shelf (personal coffees), shared library, profile, stage/phase, factory profile, Drops, dial-in.

## Brand Commitments

- **Name:** Mousetail (formerly Crema; renamed because other espresso apps already use that name). Repo/product label "ES1 Brew Lab".
- **Lockup:** lowercase "mousetail" in a drawn, joined script, its l sweeping out into a tail that ends in a drop of Crema orange (`client/src/components/BrandLockup.tsx`).
- **Independence:** Mousetail is not affiliated with, endorsed by, or supported by Fellow Products. Nothing may imply otherwise, including use of Fellow branding.
- **Voice:** plain, precise, and candid about uncertainty, as in the README: says what is inferred, what is measured, and what could break.

## Evidence on Hand

- Seed data (`pnpm seed`): demo coffees, profiles, a dial-in in progress, and three demo brewers (`michael@`, `dana@`, `sam@example.com`) that exist to populate Explore. They are not real users.
- Fellow's seven factory profiles ship as starting points; fifteen built-in grinder calibrations, tagged by confidence.
- No testimonials, user counts, press, benchmarks, or endorsements exist. Do not fabricate any.

## Product Principles

1. **The dial-in loop wins ties.** When tradeoffs collide, favour logging a shot and acting on the next change over every other job.
2. **One change at a time.** Guidance narrows the next step; it never hands back a menu of adjustments.
3. **Show confidence, never fake precision.** Estimated, inferred, and model-filled values are labelled as such wherever they appear.
4. **Never touch what isn't yours.** Writes to the Fellow account fail closed, and the UI says what will happen before it happens.
5. **Degrade honestly.** A missing key, an unprofiled machine, or an unreachable Fellow API disables the affected feature with its reason; the rest keeps working.
