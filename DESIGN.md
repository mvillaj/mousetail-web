---
name: Mousetail
description: A warm, friendly espresso app whose one "press me" colour is Crema orange, or your ES1's finish if you pick it.
colors:
  body-crema: "#d9622b"
  on-body-espresso: "#2a1408"
  link-burnt: "#a8410f"
  chart-pressure: "#a5612c"
  action-walnut: "#7b4a2b"
  on-action-cream: "#fff8ef"
  body-sesame: "#ebdfc8"
  on-body-roast: "#3a2616"
  body-cherry: "#c4302b"
  body-marine: "#2c5a9a"
  body-woodland: "#3d6a4b"
  body-chocolate: "#6a4635"
  body-black: "#1f1c1b"
  ground-sesame: "#f4f2ee"
  ground-counter: "#f7f3ee"
  surface: "#fffdfa"
  surface-2: "#f3ede5"
  field: "#faf6f1"
  border: "#ebe3d9"
  border-strong: "#d8cbbb"
  text: "#2b211c"
  text-dim: "#685a4f"
  text-faint: "#8f8175"
  ground-dark: "#151211"
  surface-dark: "#211c1a"
  surface-2-dark: "#2c2623"
  text-dark: "#f6efe8"
  good: "#3f7a3a"
  warn: "#946510"
  bad: "#b03c2a"
  cool: "#33689a"
  star: "#e3a21a"
  espresso-liquid: "#3a2215"
  crema-sour: "#ecdba6"
  crema-sourish: "#ddb977"
  crema-balanced: "#c4874a"
  crema-bitterish: "#8f552d"
  crema-bitter: "#5a341d"
  crema-unknown: "#cdb9a2"
  stage-pre: "#5b8fc0"
  stage-infusion: "#c4874a"
  stage-ramp: "#8f552d"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.9rem, 3.2vw, 2.55rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 72"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.15rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 48"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "'opsz' 24"
  title-sm:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
    fontVariation: "'opsz' 14"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 600
  figure:
    fontFamily: "Red Hat Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1.6rem"
    fontWeight: 400
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  figure-sm:
    fontFamily: "Red Hat Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.88rem"
    fontWeight: 400
    fontFeature: "tnum"
  landing-hero:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.5rem, 5.8vw, 4.6rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 96"
  landing-section:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 72"
rounded:
  sm: "12px"
  md: "14px"
  card: "20px"
  hero: "24px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  gap: "18px"
  card: "22px"
  hero: "26px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action-walnut}"
    textColor: "{colors.on-action-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "40px"
  button-primary-lg:
    backgroundColor: "{colors.action-walnut}"
    textColor: "{colors.on-action-cream}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "40px"
  button-ghost:
    textColor: "{colors.text-dim}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
  button-coach:
    backgroundColor: "{colors.on-body-espresso}"
    textColor: "{colors.body-crema}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "50px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  coach-card:
    backgroundColor: "{colors.body-crema}"
    textColor: "{colors.on-body-espresso}"
    typography: "{typography.display}"
    rounded: "{rounded.hero}"
    padding: "26px 26px 24px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    height: "2.75rem"
  tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  nav-item:
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    height: "38px"
  tab-log-disc:
    backgroundColor: "{colors.action-walnut}"
    textColor: "{colors.on-action-cream}"
    rounded: "{rounded.pill}"
    size: "58px"
---

# Design System: Mousetail

## Overview

**Creative North Star: "Matches Your Machine"**

Mousetail is a warm, friendly consumer app for the espresso bench: soft cards on a lightly wood-cast ground, plain barista language, and one bright colour that means "press me". By default that colour is Crema orange, the house finish, so the app stands on its own whatever machine you own. Anyone who wants it to match their ES1 can pick a finish instead (Sesame, Cherry Red, Marine Blue, Woodland, Malted Chocolate, Black), and the action colour, the one filled surface, and a faint cast in the page ground all follow it. Everything else (ink, status hues, the shot glass) stays put.

The signature is the shot glass. Every shot is drawn as a demitasse on one fixed 48 g scale, so glasses compare honestly side by side, and the crema band's colour is how the shot tasted: pale for sour, hazel for balanced, dark for bitter. The glass recurs in the coach card, the dial-in strip, recent-shot rows and empty states.

Density is calm and generous: 20px card radii, pill buttons, 15px body, one instruction per screen set large in Fraunces. Light and dark are both first-class; light is the base. A first visit with no saved choice opens in light, on the landing and in the app alike; "Auto" follows the OS only once someone picks it. This world replaces the retired brown-on-brown "Bench Logbook". Colourway names describe the machine only; Mousetail carries no Fellow marks or UI.

**Key Characteristics:**
- The selected finish's body colour is the action colour and fills exactly one surface (the coach card).
- The ground takes a faint cast of the machine; cards sit on it with soft offset shadows (light) or a hairline border (dark).
- Fraunces headings, Figtree UI, Red Hat Mono for figures only.
- Every shot is a demitasse: height is yield on a fixed scale, crema colour is taste.
- Tamp-feel press on every button: a small give and settle, never a bounce.
- Drawn Lucide line icons throughout.

## Colors

A warm neutral ground and ink, one finish-driven action colour, and a fixed set of coffee and status hues that never change with the finish.

### Primary
- **Finish Body** (`--body`; default **Crema orange**, a burnt orange, `body-crema` with `on-body-espresso`, `#df6a31` in dark): the finish colour. Fills only the coach card, with `--on-body` text. Per theme and finish it is set in `app.css`; the machine bodies are `body-sesame`, `body-cherry`, `body-marine`, `body-woodland`, `body-chocolate`, `body-black` (dark-theme variants are slightly adjusted per finish).
- **Action** (`--action`; default **Crema orange**, the same as its body (`#e3703a` in dark), with espresso-dark `on-body-espresso` text at 4.8:1; darker than about `#cc5a26`, neither dark nor white labels pass): fills primary buttons, the raised phone Log disc, focus outlines, active nav icons, sliders, checkboxes, the caret and the latest-shot marker. It equals the body except where the body cannot carry a label on its ground: Sesame in light uses walnut (`action-walnut` on `on-action-cream`); Sesame in dark uses the sesame body itself (`#e6d7bb` on `#2b1d12`); Black in dark uses an off-white button (`#f1ebe4` on `#1a1614`). Dark variants of Cherry, Marine, Woodland and Chocolate lift the action a step brighter than the body.
- **Derived action tints** (all `color-mix in oklab`): hover = 86% action into text; soft = 12% action into surface (active nav pill, highlighted tag); line = 34% action into surface (tag ring, list-item hover border, selection); focus ring = 26% action over transparent (4px input halo).

### Secondary
- **Crema scale** (`crema-sour`, `crema-sourish`, `crema-balanced`, `crema-bitterish`, `crema-bitter`, `crema-unknown`): taste, drawn as the glass's crema band. Independent of the finish. In dark the two bitter steps lift (`#a8693c`, `#84512e`) so they stay apart from the liquid and the card.
- **Espresso Liquid** (`espresso-liquid`): the body of every glass, same in both themes.
- **Brew stages** (`stage-pre`, `stage-infusion`, `stage-ramp`): fixed profile-chart stage colours, lifted in dark (`#7eaad6`, `#d49a5c`, `#a86a3e`).
- **Chart Pressure** (`chart-pressure`, `#e2a766` in dark): the pressure line, its area gradient and its axis label in profile charts. Brew data, so it ignores the finish.

### Tertiary
- **Status hues** (`good`, `warn`, `bad`, `cool`, `star`): success, caution, error, informational/flow, and rating stars. Each has a paired tint background and border per theme; dark uses lighter hues (`#86bb78`, `#dcaa4c`, `#e47a64`, `#7eaad6`, `#e8b24a`). Independent of the finish.

### Neutral
- **Counter Ground** (`ground-counter`): the warm base ground in light. The rendered page background is `--bg` = 7% of the body mixed into it (11% in dark over `ground-dark`), so a red ES1 warms the page and a blue one cools it.
- **Sesame Ground** (`ground-sesame`): the exception. Sesame is pale enough that a sesame cast would melt into the coach card, so Sesame in light gets this near-neutral warm white instead of the mix.
- **Surface** (`surface`, `surface-2`, `field`): cards, inset layers and secondary buttons, and form fields. Dark: `surface-dark`, `surface-2-dark`, `#1a1615`.
- **Lines** (`border`, `border-strong`): hairlines and dividers; strong for inputs and the picker. Dark `#322b27` / `#4a403a`.
- **Ink** (`text`, `text-dim`, `text-faint`): warm near-black, secondary and tertiary. Dark: `text-dark`, `#c2b4a8`, `#8f8277`.

### Named Rules
**The Matches Your Machine Rule.** The action colour is the finish's body, adjusted only where contrast forces it. A new finish is four values per theme (`--body`, `--on-body`, `--action`, `--on-action`); every tint derives from them. Never hand-pick a tint.

**The One Machine Surface Rule.** Only the coach card is filled with `--body`. Everything else is neutral surface; the action colour appears on presses and small indicators, not as panels.

**The Fixed Coffee Rule.** Status hues, the crema scale, the liquid and the brew stages never follow the finish. Taste and health must read the same on every machine.

**The House Finish Rule.** Crema orange is the default and is listed first in the picker, set apart from the machine colourways by a divider. Orange text on light grounds fails contrast, so links in Crema light use `link-burnt`; orange stays on fills, icons and indicators.

**The Off-White Exception Rule.** Where the action resolves to off-white or pale sesame on a dark ground (Black dark, Sesame dark), small indicators that would use the action colour (links, active nav and tab icons, latest-shot marker) use `--text` instead.

## Typography

**Display Font:** Fraunces (optical size 9 to 144, weights 400 to 700, Soft axis fixed at 100), with Georgia fallback
**Body Font:** Figtree (400 to 700), with the system sans stack
**Label/Mono Font:** Red Hat Mono (400 to 600), with ui-monospace

**Character:** Fraunces is a soft serif: its rounded corners echo the round ends of the monoline wordmark, and the serif gives headings a warm, café-menu voice that sits beside the script rather than imitating it. Figtree keeps the UI round and plain. Red Hat Mono was chosen for readings because it stays legible at small sizes without reading as a typewriter.

### Hierarchy
- **Display** (600, clamp(1.9rem, 3.2vw, 2.55rem), 1.04, opsz 72): the coach's one barista instruction ("Grind 2 steps finer"). 1.75rem on phones.
- **Headline** (600, 2.15rem, 1.08, opsz 48): page titles (h1). 1.75rem on phones.
- **Title** (600, 1.3rem, 1.2, opsz 24): card and section heads (h2). 1.18rem on phones.
- **Title small** (500, 1.05rem, 1.3, opsz 14): h3, empty-state heads.
- **Body** (400, 15px, 1.55): all UI prose. Page intros cap at 62ch, coach reasons at 46ch, changelog at 72ch.
- **Label** (600, 0.76 to 0.88rem): field labels, nav group labels, stat labels, table heads. Sentence case, no tracking, no uppercase.
- **Figure** (Red Hat Mono 400 to 500, tabular numerals): stat values (1.6rem), dial-in times (0.88rem), table numbers, number inputs, summary totals, chart labels, signed deltas.
- **Wordmark**: not a typeface. Lowercase "mousetail" is drawn as an SVG (see Brand Lockup), so no font is loaded for it; never imitate it with a script face in headings or UI.
- **Landing hero** (600, clamp(2.6rem, 5.4vw, 4.4rem), 1, -0.02em, opsz 96): the public landing's h1 only.
- **Landing section** (600, clamp(1.9rem, 3.4vw, 2.75rem), 1.06, -0.02em, opsz 72): the landing's section h2s.

### Named Rules
**The Figures-Only Mono Rule.** Red Hat Mono sets numbers and only numbers. Units and words beside a figure ("g", "s", "Leaning sour") are Figtree. A signed delta is a mono figure (with a true minus, `−`) followed by its unit in prose.

**The Optical Size Rule.** Every Fraunces use sets `font-variation-settings: 'opsz'` to match its size (14, 24, 48, 72, and 96 for the landing hero). Do not let headings default to one optical size.

**The Barista Voice Rule.** Headlines are instructions you could say across the counter: "Grind 2 steps finer", "Let it run to 1:2.4", "Keep this grind". Confidence is said in words ("Fairly sure"), never as a percentage.

## Layout

Desktop is a two-column grid: a 248px sticky sidebar and a main column (padding 36px 44px 88px, max 1180px). The sidebar shares the page ground; it is navigation, not a panel, and its nav scrolls independently on short windows while brand and footer stay put.

The Dashboard top row is a 1.15fr / 1fr grid (coach card, dial-in strip) at an 18px gap, collapsing to one column under 1020px; below it a quiet one-line summary, then recent shots. Card grids use auto-fit with minimums of 300, 240 and 165px.

At 860px and below the sidebar is replaced by a slim sticky top bar (brand, blurred translucent ground) and a fixed five-slot bottom tab bar with the Log shot disc raised in the centre; "More" opens a bottom sheet holding every destination plus theme and finish. At 600px and below, main padding drops to 14px, cards to 16px padding and 18px radius, grids go single column (stat grids two up), tables become one labelled block per row, and inputs use 16px text to stop iOS zoom.

Spacing rhythm runs 6 / 10 / 16 / 18 / 22 / 26 / 28px: 6px inside tight groups, 16px stacks, 18px grid gaps, 22px card padding, 26px hero padding, 28px under page heads. Touch devices (`pointer: coarse`) raise buttons to 46px, small buttons to 40px, icon buttons to 44px and nav rows to 48px.

### Named Rules
**The One Press Rule.** One primary press per viewport. The header's "Log a shot" button disappears when the coach card is showing (the coach carries the press), and on phones the header button is hidden entirely because the tab bar carries Log shot.

## Elevation & Depth

A hybrid that changes by theme. In light, cards, stats and list items lift off the ground with a soft, warm, two-part offset shadow. In dark, those shadows are removed and a 1px `--border` hairline separates the layers, with a clear tonal step from ground to surface to surface-2. Floating layers (popover, modal, sheet, tab-log disc) use a stronger pop shadow in both themes, and in dark the popover and modal also take a `border-strong` outline. Scrims are warm-tinted.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(60, 40, 25, 0.05), 0 10px 28px -16px rgba(60, 40, 25, 0.18)`): resting cards, stats, list items in light. `none` in dark.
- **Pop** (`box-shadow: 0 2px 6px rgba(60, 40, 25, 0.08), 0 24px 48px -20px rgba(60, 40, 25, 0.32)`; dark `0 2px 6px rgba(0,0,0,0.4), 0 24px 48px -20px rgba(0,0,0,0.7)`): settings popover, modals, bottom sheet, the raised Log disc.
- **Tab bar** (`--shadow-bar`: `0 -8px 24px -18px rgba(40, 28, 20, 0.3)`, dark `rgba(0,0,0,0.6)`): the phone tab bar's soft upward lift.
- **Chip** (`--shadow-chip`: `0 1px 3px rgba(40, 28, 20, 0.12)`, none in dark): the selected segment of a segmented control.

### Named Rules
**The Soft-Light, Lined-Dark Rule.** Light cards carry the card shadow and a transparent border; dark cards carry no shadow and a visible `--border`. Never ship a shadowed card in dark or a bordered one in light.

**The No Hard Offset Rule.** Shadows are diffuse and negatively spread. No solid, zero-blur offset shadows.

## Shapes

Generous and soft. Cards and list items round at 20px (18px on phones); the coach card, modals and the bottom sheet's top corners at 24px; stats, the settings popover at 14px; inputs, nav rows, banners and table-row hovers at 12px. Every button, tag, segmented control and the tab-log disc is a full pill or circle. The finish picker is a row of 24px circles split diagonally into body and wood. The demitasse silhouette (tapered cup, rounded base, loop handle) is the one recurring drawn shape.

## Components

### Buttons
Tactile and friendly: pills that give under the thumb.
- **Shape:** full pill (999px); 40px tall by default, 32px small, 50px large, 36px circular icon button.
- **Primary:** action colour with on-action text, Figtree 600 at 0.92rem, padding 8px 18px. Hover darkens toward ink (86% action).
- **Press:** `transform: scale(0.95) translateY(1px)`, 80ms in, settling back over 220ms on the ease-out-quint curve (`cubic-bezier(0.22, 1, 0.36, 1)`). Transform only, no layout shift, no overshoot. Disabled under reduced motion.
- **Secondary:** surface-2 fill with ink; hover mixes 16% ink in.
- **Ghost:** transparent with dim ink; hover surface-2 and full ink.
- **Danger:** transparent, bad-hue text, bad tint border; hover bad tint fill.
- **Coach inversion:** inside the coach card the primary inverts to `--on-body` fill with `--body` text, because the card itself is the action colour; ghosts there use on-body dim.
- **Focus:** 2px action outline, 2px offset.

### Chips
- **Style:** pill tags, 0.78rem 600, padding 3px 10px, surface-2 with dim ink.
- **State:** the highlighted tag (`.tag.accent`) uses action-soft fill with a 1px action-line inset ring and full ink; status tags use the status hue on its tint.

### Cards / Containers
- **Corner Style:** 20px (18px phone).
- **Background:** surface.
- **Shadow Strategy:** card shadow in light, border in dark (see Elevation).
- **Border:** transparent in light, `--border` in dark.
- **Internal Padding:** 22px (16px phone); tight variant 16px.
- **List items:** same skin at 18px 20px padding; hover tints the border action-line and press scales to 0.985.

### Inputs / Fields
- **Style:** field fill, 1px border-strong, 12px radius, 9px 12px padding, 2.75rem tall (2.9rem on phones). Number inputs set in Red Hat Mono.
- **Focus:** border turns action, plus a 4px focus-ring halo.
- **Selects:** custom drawn chevron; sliders and checkboxes use `accent-color` action.
- **Segmented control:** pill track in surface-2; the selected segment is surface with a faint shadow in light, border-strong fill in dark.

### Navigation
- **Desktop sidebar:** on the page ground. Rows are Figtree 500 at 0.95rem in dim ink with 19px Lucide icons, 12px radius; hover surface-2. Active row is an action-soft pill with full ink at 600 and the icon in the action colour. Group labels are 0.76rem 600 faint, sentence case.
- **Account row:** name, then a Palette icon button opening a 272px popover (Theme: segmented light/dark/auto, where no saved choice resolves to light and auto tracks the OS live once chosen; Colour: Crema orange, a divider, then the six machine finishes, with the current name below), and a sign-out icon button.
- **Phone:** sticky blurred top bar with the brand; fixed bottom tab bar of five slots (0.72rem 600 labels, 22px icons, active icon in action), with Log shot as a raised 58px action disc ringed 5px in surface. "More" opens a bottom sheet (24px top radius, grip, full nav and settings inline).

### Shot Glass (signature)
A demitasse drawn in SVG (viewBox 60 by 62). Liquid height is yield on a fixed 48 g scale shared by every glass; a pull over 48 g stops at the rim and gets a small overflow chevron instead of a taller glass. The crema band (20% of the liquid, 3.2 to 9 units) takes the crema scale colour for the recorded taste, neutral crema-unknown when untasted. Balanced shots show three soft tiger-stripe flecks. The glass back and stroke follow the theme; the liquid and crema do not. When the coach shows a new shot, its glass pours once (scaleY from 0.15 over 0.9s, ease-out): the page's one authored moment.

### Coach Card
The one machine-coloured surface: `--body` fill, `--on-body` ink, 24px radius, 26px padding. The last shot's glass sits left; the barista instruction in display type, the reason in on-body dim (46ch), then mono figures for the shot. An on-body hairline separates the actions row: the inverted primary, an optional ghost, and the confidence in words at the end. On phones the glass tucks into the top-right corner, the primary goes full width and the ghost hides.

### Dial-in Strip
This coffee's shots as a row of glasses, oldest left, on the shared scale. Each column shows its time in mono (good hue when on target), a signed delta in faint Figtree with mono figures, and reserves a 6px dot so glasses share a baseline; the latest shot's dot is the action colour. A legend of crema swatches closes the card.

### Brand Lockup
Lowercase "mousetail" drawn as one joined monoline script in current ink, whose l runs on into a long sweeping tail (the "mouse tail") that curls over and ends in a drop. The drop and the curl it hangs from are always Crema orange `#d9622b`, never the action colour, which on Sesame and Black would sink into the ink. It is an SVG traced from the approved artwork and sized by height (1.4em), so it scales with font-size wherever it sits; the plain word is kept for screen readers. On the sign-in hero the word writes itself in from the left and the drop falls, once. The favicon is the extraction ring, not the wordmark: on an espresso tile (`#2E1B0F`), a cream ring (`#F9F1E6`) open on the right, a burnt-orange stream (`#C45A1E`) hugging the inside of it from a fine tail on the left to full weight at the top right, and a peach drop (`#E3A471`) sitting in the ring's opening. It is the supplied artwork (`client/public/favicon.svg`), used as drawn.

### Working Indicator
Four 3px bars pulsing in currentColor like a shot being pulled, with an optional mono elapsed clock; static under reduced motion.

### Profile Chart
Brew data drawn as the pump runs it. Pressure is a `chart-pressure` line over a gradient area, drawn eased: each stage edge, and the start from 0 bar, is a smootherstep blend between the neighbouring stages' lines, so it never overshoots either one (a 9 bar stage still peaks at 9 bar). A blend reaches at most 1.8s either side of an edge (2.4s from 0 bar) and stays inside both stages. The flow ceiling stays a step, because it is a limit and reads exactly as the profile states it. Stage bands sit behind in the fixed stage colours at `--chart-area-opacity`. Every pressure curve, in the app and on the landing, comes from the one shared easer (`lib/curve.ts`); never draw a profile as straight lines with vertical steps.

### Landing
The public front page opens on a photograph and then becomes one shot pulled across the page in the app's own world.
- **Splash:** a full-screen (`100svh`) photograph of an espresso stream, sticky behind the page. On it: the lockup and a Sign in ghost pill, the h1 (Landing hero type at clamp(2.6rem, 5.4vw, 4.4rem), max 7.6em, sized so it clears the stream at desktop widths), one Figtree line, one large primary Create account, and a "Watch a shot pull" link to the pull. Ink on the photo is fixed cream `#fff8ef` (dim at 80%) in every theme and finish, because the photo never changes; the press and the lockup's stream use the finish's dark-ground action (`--action-on-dark` / `--on-action-on-dark`, each finish's dark-theme action in either theme), so Black gives an off-white pill and no finish vanishes into the photo. A warm three-part scrim (top, bottom, left) shades only where words sit. The photo settles from 1.05 scale once on arrival and the scrim darkens as you scroll; both are off under reduced motion. Responsive WebP at 640 to 2000w with JPEG fallback, `fetchpriority=high`; under 520px tall the splash pins by its bottom edge so the press stays reachable; provenance in `client/src/assets/hero/SOURCE.md`.
- **Sheet:** everything after the splash is a sheet on `--bg` with 28px top corners (22px on phones) that slides up over the photo.
- **The pull** (first section of the sheet, under a Landing section h2 and a 60ch lead): a full-bleed profile plot (clamp(240px, 34vh, 420px), 300px on phones) with stage bands running to the viewport edge over a `border-strong` baseline. The eased profile shows first as a dashed ghost, then draws over it in `chart-pressure` (3px) behind a 1px playhead, with a stage-coloured dot ringed in `--bg` riding the curve. The shot ends a gutter short of the edge and its tail fades out across the gutter. It waits until half the plot is on screen, then the 35s shot plays in about 5s (140ms per machine second) after a short beat; reduced motion shows the finished curve and full glass at once. "Pull it again" (small secondary pill) sits in the caption below with the profile's dose, yield and temperature in mono.
- **Readout card:** floats over the plot, following the playhead and clamped so it never hangs off either end. Surface fill, 14px radius and the pop shadow (plus a `border-strong` outline in dark), like the popover. It holds a Shot Glass that fills to the shot's 36 g as it pours (liquid scaleY from the bottom, paced by cumulative pressure) beside live mono figures (bar, s, and the stage's flow limit labelled "ml/s max") and the current stage with its colour dot; at the end it reads "36 g out, balanced". On phones the glass drops to 32px and the flow figure hides.
- **Stage labels:** hung below the baseline at each band's start (the last right-aligned to the edge), 0.86rem 600 with a stage-colour dot and the band's seconds in faint mono beneath. Each links to its section; hover gives a surface pill and an underline.
- **Gutter curve slices:** each story section is a 200px gutter beside the body, and the gutter carries a sticky (top 32px) 220 by 72 copy of the same eased curve: dashed at rest, with only that section's stage lit in its stage colour and area, labelled with its name and seconds. At 860px and below the section becomes one column: the h2 and lead come first, then the slice (150px, 120px on phones) beside its label, leading the demos.
- **Closing glass:** the last section's gutter swaps the slice for the 36 g Shot Glass at 84px (56px at 860px and below), labelled "End of shot", "36 g out": the shot has poured. The close below centres a large lockup (clamp(3.2rem, 8vw, 5rem)), one Fraunces 600 line in dim ink (opsz 24), and the CTAs again.
- **Reuse:** one demo per section, each the dashboard's own component on sample inputs: the Dial-in Strip (alone, max 520px), the Coach Card (inverted primary, beside a "Your last shot" input card), and the Profile Chart beside three short facts. CTAs are Create account (large primary) and Sign in (large secondary; a ghost pill in the top bar).

### Compatibility aliases
`app.css` still defines the legacy aliases (`--crema`, `--crema-dim`, `--espresso`, `--on-accent`, `--accent-hover`, `--tint-accent-*`, `--banner-*`, `--shadow`). The landing and charts no longer read any of them; the only remaining reads are the `.banner` rules, which use `--banner-*`. New code reads the current token names.

## Do's and Don'ts

### Do:
- **Do** derive every action tint from `--action` with `color-mix(in oklab, ...)`; a new finish adds only `--body`, `--on-body`, `--action`, `--on-action` per theme.
- **Do** keep the coach card the only `--body`-filled surface, and invert its primary button to on-body / body.
- **Do** draw every shot as the shared Shot Glass on the fixed 48 g scale, with crema colour from the taste.
- **Do** set figures in Red Hat Mono with tabular numerals and their units and words in Figtree.
- **Do** give every button the tamp-feel press (`scale(0.95) translateY(1px)`, ease-out-quint) and remove it under reduced motion.
- **Do** keep one primary press per viewport: hide the header Log button when the coach shows, and let the tab bar carry Log shot on phones.
- **Do** use soft card shadows in light and a hairline border in dark.
- **Do** use drawn Lucide line icons at 17 to 22px.
- **Do** write headlines as barista instructions and confidence in words.
- **Do** draw pressure eased through the shared smootherstep easer (never overshooting a stage) and keep the flow ceiling a step.

### Don't:
- **Don't** tie status hues, the crema scale, the espresso liquid or brew-stage colours to the finish.
- **Don't** use a pale or off-white action colour for small indicators on dark grounds; use `--text` there (Black dark, Sesame dark).
- **Don't** cast the Sesame light ground with the body; it stays `ground-sesame`.
- **Don't** add bounce or overshoot to press or entrance motion.
- **Don't** put units or words in mono, or set headings without a matching optical size.
- **Don't** use Fellow logos, marks or UI; finish names describe the colourway only.
- **Don't** add new reads of the legacy aliases (`--crema`, `--espresso`, `--on-accent`, `--tint-accent-*`, `--banner-*`).
- **Don't** return to the retired brown-on-brown palette with a single amber accent.
