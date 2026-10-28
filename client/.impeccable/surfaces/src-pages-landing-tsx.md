---
version: 1
slug: "src-pages-landing-tsx"
primary_target: "src/pages/Landing.tsx"
related_targets: ["src/App.tsx","src/components/charts.tsx","src/lib/theme.tsx"]
---

# Landing (public "/")

Scope: the public front page shown at `/` to signed-out visitors. Mode: Persuade.

Audience: Fellow ES1 owners who have never heard of Mousetail (and the owner, returning signed out). Job: understand in seconds that this is an espresso logbook + dial-in coach + profile studio for the ES1, and who it's for. Action: Create account (primary), Sign in (secondary). Auth lives at `/sign-in` and `/sign-up`.
Proof: live demos running the app's own shared code on labelled sample data. No testimonials, stats, or users exist; none are invented. Independence from Fellow stated.
Constraints (user, 2026-10-12): first visit must not overwhelm; a full-screen espresso photograph is the first screen, with headline and one press only; the pull moves below it; sections trimmed to one demo each.
Earlier constraints (user, 2026-10-04): match the redesigned dashboard world; pressure graphs are smooth curves everywhere (landing and in-app charts); first-time visitors get light, landing and app alike, until they choose.

## Direction contract

THESIS: The page is one shot, now pulled in the app's own world. A single curved pressure profile runs across the page and its stages structure the story; the shot ends in a glass. Refuses the split hero with a screenshot and a three-card feature row.
OWN-WORLD: Mousetail as in DESIGN.md: warm counter ground with the finish's faint cast, soft-shadowed 20px cards (hairline in dark), pill buttons with tamp press, Fraunces headings with matched opsz, Figtree UI, Red Hat Mono figures only. Pressure line in chart-pressure, stage bands at chart opacity, the Crema orange only on presses and the one coach card.
STORY: See the pour; watch a shot pull and pour into a glass; learn Mousetail logs every shot as a glass on one scale (grind stored in microns), hands back one barista instruction, builds profiles the ES1 can run; read that it is independent and honest; create an account.
FIRST VIEWPORT (2026-10-12): full-screen photo of the pour (100svh, sticky); lockup + Sign in ghost on it, h1, one Figtree line, one Create account press in the finish's dark-ground action, and a "Watch a shot pull" cue. Nothing else. The page slides up over it as a sheet.
PULL SECTION: first section of the sheet. A Landing-section h2 and a 60ch lead, then the full-bleed curved Modern Arc profile drawing over ~5s once half of it is on screen, stage bands to the edge, playhead dot, floating readout card whose glass fills to 36 g with live bar, s, flow-limit figures and the stage; caption with Pull it again. No top bar or CTAs here. Then one demo per section: dial-in strip, coach, profile chart.
FORM: Inherited Mousetail surface (no concept round: user pinned structure), seed key none — direction carried over from 869fab12 into dashboard world 4455cff9. Signature: the curve draws as a live pull and pours into the glass; reduced motion shows the finished curve and full glass.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
