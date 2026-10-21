---
name: ui-design
description: Design and build good-looking, polished user interfaces - web pages, landing pages, dashboards, settings/forms, mobile web screens, and egui/eframe desktop apps. Read this before writing or restyling any HTML/CSS/JS, React, or egui UI code, and whenever asked to make something look better.
---

# UI design

Good UI is mostly discipline: one direction, a small set of tokens used everywhere, real content, and no
defects. Follow the steps in order. Do not skip step 2.

## 1. Pick a direction (one line, before any code)

Write one line: who uses it, the mood, and which preset below. Match the product, don't default to the first one.

| Preset | Use for | Fonts (Google Fonts) | Look |
|---|---|---|---|
| **Calm SaaS** | B2B tools, settings, admin | Inter | white/very light gray surfaces, slate text, one blue or indigo accent |
| **Warm editorial** | marketing, content, consumer brands | Fraunces (headings) + Inter | cream background, deep ink text, one rich accent (teal, terracotta, forest) |
| **Dark technical** | dev tools, monitoring, dashboards | Inter + JetBrains Mono | near-black layered surfaces, one bright accent, colored status only |
| **Friendly bright** | consumer apps, habits, mobile | Plus Jakarta Sans | soft tinted background, rounded 16-20px cards, one saturated accent + one soft tint |

The exact token values for each preset are in `reference/web-starter.css` (`[data-theme=...]` blocks).

## 2. Tokens first, then components

Start every web page from `reference/web-starter.css`: copy it into the `<style>` block, set
`<html data-theme="...">`, then add page styles that use **only** the variables. Never type a raw hex color,
font size, or spacing value in component CSS - if you need a new one, add a token.

- Type scale (px): 12, 14, 16, 20, 24, 32, 48 (64 for a landing hero only). Body 15-16, line-height 1.5-1.6.
  Headings line-height 1.1-1.25, letter-spacing -0.01 to -0.02em. Max 2 font families, max 3 weights (400/500/600 or 700).
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96. Everything sits on it. Section padding 64-96 desktop, 48 mobile.
- Radius: one value for controls (8), one for cards (12-16), full for pills. Don't mix more.
- Color: neutrals for 90% of the UI, ONE accent for primary actions/selection, status colors (green/amber/red)
  only for status. Text levels: primary, secondary (muted), tertiary (faint) - never more.
- Shadow: subtle (`0 1px 2px` + `0 4px 12px` at low alpha) or none; borders 1px in a neutral.

## 3. Build with the recipes

- Page layouts (landing, dashboard, settings, mobile app, list+detail): `reference/layouts.md`.
- Icons: copy inline SVGs from `reference/icons.md`. **Never use emoji as icons.**
- egui/eframe desktop apps: read `reference/egui.md` instead of the web starter.

Every interactive element needs hover, focus-visible, active, and disabled states. Forms need labels,
helper/error text, and 40-44px tall controls. Real-sounding content (names, numbers, dates) - never lorem ipsum.

## 4. Contrast rules (the most common bug)

- Text on the accent (buttons, badges): use `var(--on-accent)`. Never put accent-colored text on an accent background.
- Muted text must still be readable: secondary text at least 4.5:1 against its background.
- Buttons in a dark header/hero: check the text color against THAT background, not the page background.
- On dark themes don't use pure black (#000) or pure white text for long copy; use the tokens.

## 5. You can't see the page - build so it can't break

- Anything that starts hidden (mobile menu, dropdown, modal, bottom sheet, toast) gets the `hidden` attribute or
  `display:none` in CSS and is shown only by JS on click. Never rely on `transform`/`opacity` alone to hide it.
- Desktop and mobile navigation: one `<nav>`; hide the desktop links under 760px with a media query and show a
  menu button instead. Never render both lists at the same time.
- Fixed bottom bars / floating buttons: give `body` (or the scroll container) `padding-bottom` >= the bar height + 16px.
- Every flex/grid child that holds text gets `min-width: 0`; table cells `white-space: nowrap` (the starter does it).
- Prefer fewer components done right over many half-checked ones.

## 6. Verify with the audit, then fix

If you have the `ui_audit` tool, call it on your page (`ui_audit` with `path: "index.html"`). If you only have
`bash`, run `node ~/.omp/agent/skills/ui-design/scripts/ui-audit.mjs index.html --views .ui-audit`.
If you have neither, skip this step - don't look for other ways to run it.

Budget: **at most 2 audit runs** in total. Then you are done.

Round 1 (after the first full write):
1. Run the audit. Fix every `[high]` and `[med]` item.
2. **Look at the screenshots** it lists (`.ui-audit/desktop-1.png` ... `mobile-3.png`) with the read tool, once,
   and review them like a strict designer: can you read every button and link label against its background? Is
   anything overlapping, cut off, squeezed, misaligned, cramped, or oddly empty? Does the most important thing
   stand out? Does the phone layout look designed, not just shrunk? List each defect with its location.
3. Fix the listed defects with small `edit` calls (one per defect). **Never rewrite the whole file after the first
   write** - rewriting loses earlier fixes and floods your context.

For a UI page the audit IS the verification: don't write separate test or smoke scripts for it.

Round 2: run the audit once more. If it shows `0 high, 0 medium`, finish immediately with your short summary - do
not open the screenshots again and do not polish further. If items remain, fix only those with `edit`. Never finish with a `[high]` item open: if one is left, fix it
and run the audit one last time (a third run is allowed only for this).

It renders the page at 1440px and 390px and reports: sideways overflow, content cut off at the edge, overlapping,
clipped or squeezed text, low contrast (element + ratio), open overlays, duplicated navigation, fixed bars
covering content, repeated chart labels, missing viewport meta, frozen pages (infinite loops), tiny text, small tap targets, default browser
styling, broken images, JS errors, too many font sizes.

## 7. Self-review checklist (always, even without a shell)

Read your own file top to bottom and check:

1. `<meta name="viewport" content="width=device-width, initial-scale=1">` present; nothing wider than the screen at 390px
   (use `minmax(0,1fr)`, `flex-wrap`, `overflow-x:auto` on tables).
2. Every color/size/space comes from a token. At most 7 distinct font sizes.
3. One primary button per view; secondary actions are secondary/ghost buttons.
4. Alignment: one left edge per column, consistent gaps, cards in a row are equal height.
5. Hierarchy: the most important number/heading is clearly the biggest; labels are small and muted.
6. Empty, loading, and error states exist where data can be missing.
7. No emoji icons, no rainbow gradients, no more than one accent color, no centered body paragraphs wider than 60ch.
8. Mobile: tap targets >= 44px, inputs font-size 16px, single column, sticky bottom action bar if the screen has a main action.

## Anti-slop list

Avoid the things that make generated UIs look generated:
- purple-to-pink gradients, glassmorphism everywhere, glowing blobs behind the hero
- emoji in headings, buttons or nav; "🚀 Get started"
- every section centered; three identical feature cards with an icon in a circle as the only layout idea
- gray text on gray background; light-gray placeholder used as the label
- inconsistent corner radii, random shadows, five shades of the same blue
- tables without alignment (numbers must be right-aligned with `font-variant-numeric: tabular-nums`)
- giant hero padding that pushes all content below the fold on a laptop (hero <= 85vh)
