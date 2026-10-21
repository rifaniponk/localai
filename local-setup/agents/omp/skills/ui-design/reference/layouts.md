# Page recipes

All class names below come from `web-starter.css`. Adapt content, keep the structure and spacing.

## Landing page

Sections, top to bottom (each `<section class="section"><div class="container">`):

1. **Header** (64px tall, sticky, `background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border)`):
   logo mark + name left; 3-4 `.btn-ghost` links; one `.btn-primary .btn-sm` right. Links collapse to a menu icon under 760px.
2. **Hero**: left-aligned or centered, max-width 720px for the text block. `.eyebrow` -> h1 (`--fs-hero`, max 2-3 lines,
   `text-wrap: balance`) -> one `.muted` paragraph at 18-20px (max 60ch) -> `.row` with `.btn-primary .btn-lg` and
   `.btn-secondary .btn-lg` -> small `.faint` reassurance line with `margin-top: var(--s-4)` (not jammed under the buttons).
   Then a product visual: a realistic UI mock built from cards/badges/avatars (not an empty gradient box).
3. **Social proof**: 5-6 customer names as text logos in `--text-3` at 600 weight, 18px (still >= 4.5:1).
4. **Features**: section heading + intro, then either a 3-col `.grid` of `.card`s (icon in a 40px `--accent-soft`
   square, h3, 2-line `.muted` text) OR alternating text/visual rows. Don't do both with identical cards.
5. **How it works**: 3 numbered steps.
6. **Testimonial**: one large quote (24-28px, `--font-head`), avatar + name + role.
7. **Pricing**: 3 `.card`s, middle one highlighted with `border: 2px solid var(--accent)` and a `.badge-accent`.
   Plan name, price (`--fs-3xl`, `.num`), one-line description, check-list, full-width button pinned to the bottom
   (`display:flex; flex-direction:column` + `margin-top:auto` on the button).
8. **Final CTA** band in `var(--accent)` with `color: var(--on-accent)`, buttons inverted (white background, accent text).
9. **Footer**: logo, 3-4 link columns, copyright in `.faint`.

## Dashboard (admin / analytics)

```
.app
  aside.sidebar      logo, nav (.nav-link with icon, aria-current on active), spacer, user row at bottom
  main.main
    .page-header     h1.page-title + .muted subtitle | .segmented date range + .btn-secondary Export
    .grid (4 KPI cards)   .stat-label, .stat-value, .delta-up/.delta-down + "vs last period" in .faint, sparkline
    two-column row   grid-template-columns: minmax(0,2fr) minmax(0,1fr)
       .card chart (title + legend + SVG area/line chart, y gridlines, x labels)
       .card ranked list (top products: name, bar, value)
    .card table      recent orders: id (.mono), customer (avatar+name), date, status .badge-*, amount (.num right)
```
- KPI value is the biggest text on the card; label above it is small and muted.
- Status badges: success = paid/delivered/active, warning = pending, danger = failed/refunded, neutral = draft.
- Charts: draw with the SVG helper below. Never leave a chart area empty or use a placeholder image.
- Data must agree with itself: rankings sorted by the number shown, KPI totals match the table/chart,
  percentages add up, dates fall in the selected range.
- Phones (<640px): KPI grid 2 columns or 1; tables keep 3-4 columns max (add `class="hide-sm"` to the `<th>` and
  `<td>`s of secondary columns) or render each row as a small card; the sidebar becomes a top bar with the logo
  and a horizontally scrollable nav (`overflow-x:auto`), never clipped.

## Settings page

```
.app (or a top bar + container)
  main.main (max-width ~960px)
    .page-header   h1 Settings + muted line
    layout: grid-template-columns: 200px minmax(0,1fr); gap: var(--s-6)
      nav (vertical .nav-link list: Profile, Notifications, Security, Billing; sticky top)
      .stack with one .card per section:
         card header: h2 (--fs-lg) + .muted description, then .divider
         rows: label+hint on the left (max 320px), control on the right (`.spread` rows, `border-bottom` between)
         card footer: right-aligned .btn-secondary Cancel + .btn-primary Save
```
- Notifications: rows with title + description + `.switch` on the right.
- Security: password fields, 2FA row with `.badge-success` "Enabled", sessions list with device + location + `.btn-ghost .btn-sm` Revoke.
- Billing: current plan card (plan name, price, renewal date, `.progress` for usage), payment method row
  (card brand + `•••• 4242` + expiry), invoices `.table` with Download icon buttons.
- Danger zone at the bottom: `.card` with `border-color: var(--danger-soft)` and `.btn-danger`.
- Under 860px the left nav becomes a horizontal scrollable `.segmented`/tab row.

## Mobile app screen (design at 390px wide)

```
body: max-width 430px; margin: 0 auto; min-height: 100dvh; padding-bottom: 96px (room for the bottom bar)
header: greeting (14px .muted) + title (24-28px bold) + date; avatar or settings icon button right
summary card: progress ring or bar for today (e.g. "3 of 5 done"), streak count with flame icon
list: each item a 64-72px row card: 44px icon tile (tinted), title + subtitle, right side check button (44x44)
       checked state: filled accent circle with white check, title gets `color: var(--text-3)` (no strike-through mess)
bottom: fixed tab bar (64px + safe area: `padding-bottom: env(safe-area-inset-bottom)`) with 4 icons + labels,
        OR a fixed primary button "Add habit" centered above it
```
- Everything tappable is >= 44px. Use `-webkit-tap-highlight-color: transparent` and a visible `:active` state
  (`transform: scale(.98)`).
- Streaks: number big, a 7-day row of small dots/squares (filled = done) under it.
- Use `localStorage` to persist toggles so the screen feels real.

## List + detail (apps, admin tools)

Left list panel 320-380px (search input + filter `.segmented` + rows with 2 lines of text and a right-aligned
metric), right detail panel (header with title, `.badge` status and actions on the right; KPI cards; details grid of
label/value pairs; activity list). Selected row: `background: var(--accent-soft)`.

## SVG charts without libraries

```html
<svg class="chart" viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Revenue, last 30 days"></svg>
<script>
// Nice axis ticks: 0, step, 2*step... with step 1/2/2.5/5 x 10^n, so labels never repeat.
function niceTicks(max, count = 4) {
  const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}
// fmt examples: (v) => "$" + (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v)
//               (v) => v + "%"
function areaChart(svg, values, { color = "var(--accent)", labels = [], fmt = (v) => v.toLocaleString() } = {}) {
  const W = 600, H = 220, P = { t: 12, r: 8, b: 26, l: 48 };
  const ticks = niceTicks(Math.max(...values));
  const max = ticks[ticks.length - 1] || 1;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (values.length - 1);
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  let g = "";
  for (const v of ticks) {                       // gridlines + y labels
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" />`;
    g += `<text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--text-3)">${fmt(v)}</text>`;
  }
  labels.forEach((t, i) => { if (t) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--text-3)">${t}</text>`; });
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const id = "g" + Math.random().toString(36).slice(2);
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${g}<path d="${line} L${x(values.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}
</script>
```
Give the svg a fixed CSS height (`width:100%; height:220px`) and the CSS rule `.chart text { font-family: var(--font-body); }`. Pass at most ~8 x labels (empty strings for the rest)
so they never collide. For bars, draw `<rect rx="3">` per value with the same
axes. For sparklines in KPI cards use the same function with `P` all 2 and no gridlines/labels.
