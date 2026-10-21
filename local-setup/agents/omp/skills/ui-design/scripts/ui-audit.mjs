#!/usr/bin/env node
// ui-audit: render an HTML page in headless Chrome and report layout and
// design defects as text, so an agent that can't see images can still fix
// what a human would notice. No npm dependencies (Node 22+, Chrome).
//
//   node ui-audit.mjs page.html                 # desktop 1440 + mobile 390
//   node ui-audit.mjs page.html --widths 1280   # custom widths
//   node ui-audit.mjs page.html --shots out/    # also save PNG screenshots
//   node ui-audit.mjs page.html --json          # machine-readable report
//   node ui-audit.mjs page.html --views DIR     # screen-sized PNGs for a vision model to look at
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log("usage: node ui-audit.mjs <page.html|url> [--widths 1440,390] [--shots DIR] [--json]");
  process.exit(args.length ? 0 : 2);
}
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const target = args[0];
const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
const widths = opt("--widths", "1440,390").split(",").map(Number);
const shots = opt("--shots", null);
const views = opt("--views", null);
const asJson = args.includes("--json");

const CHROME = ["google-chrome", "chromium", "chromium-browser", "google-chrome-stable"]
  .map((b) => process.env.PATH.split(":").map((d) => join(d, b)).find(existsSync))
  .find(Boolean);
if (!CHROME) {
  console.error("ui-audit: no Chrome/Chromium found on PATH");
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), "ui-audit-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(100);
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0];
}
if (!port) {
  console.error("ui-audit: Chrome did not start");
  chrome.kill();
  process.exit(2);
}
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const consoleErrors = [];
const waiters = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
    consoleErrors.push(m.params.entry.text + (m.params.entry.url ? ` (${m.params.entry.url})` : ""));
  }
  for (const w of [...waiters]) if (w.method === m.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
});
const send = (method, params = {}) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
// Like send, but gives up after `ms` (a page stuck in an infinite loop never answers).
const sendT = (method, params, ms) => Promise.race([send(method, params), sleep(ms).then(() => null)]);
const hung = (w) => ({ stats: { viewport: w }, issues: [{ sev: "high", kind: "page-hang",
  msg: "the page's JavaScript never finishes (infinite loop or runaway script): the browser tab freezes for real users. " +
       "Check every while/for loop and recursive call for an exit condition (e.g. date math that yields NaN keys).", where: [] }] });
// Hard stop: whatever happens, report and exit instead of hanging the caller.
const WATCHDOG = setTimeout(() => {
  console.log("ui-audit: [high] page-hang: the audit could not finish within 60s; the page's JavaScript is probably stuck in a loop.");
  try { chrome.kill("SIGKILL"); } catch {}
  process.exit(0);
}, 60000);
const once = (method, timeout = 15000) => new Promise((resolve) => {
  waiters.push({ method, resolve });
  setTimeout(() => resolve(null), timeout);
});

// Runs inside the page. Returns { stats, issues } for the current viewport.
function auditInPage(requested) {
  const vw = innerWidth;
  const mobile = requested < 640;
  const issues = [];
  const add = (sev, kind, msg, where) => issues.push({ sev, kind, msg, where });
  if (mobile && vw > requested * 1.05)
    add("high", "no-viewport", `no <meta name="viewport" content="width=device-width, initial-scale=1">: phones lay the page out ${vw}px wide and shrink it`, []);
  const sel = (el) => {
    if (!el || el === document.body) return "body";
    let s = el.tagName.toLowerCase();
    if (el.id) return `${s}#${el.id}`;
    const cls = [...el.classList].slice(0, 2).join(".");
    if (cls) s += "." + cls;
    const txt = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
    return txt ? `${s} "${txt.slice(0, 40)}"` : s;
  };
  const visible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...document.body.querySelectorAll("*")].filter(
    (el) => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "BR"].includes(el.tagName) && visible(el));
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const choice = (el) => el.tagName === "INPUT" && ["checkbox", "radio", "range", "color", "hidden", "file"].includes(el.type);
  const textEls = all.filter((el) => ownText(el) || (["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(el.tagName) && !choice(el)));

  // --- overflow -----------------------------------------------------------
  const docW = document.documentElement.scrollWidth;
  if (docW > vw + 1) {
    const wide = all
      .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== "fixed")
      .filter((el) => !el.closest("[style*='overflow'], .overflow-x-auto, pre, table"))
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    add("high", "h-overflow", `page scrolls sideways: content is ${docW}px wide in a ${vw}px viewport`,
      wide.slice(0, 4).map(sel));
  }
  for (const el of all) {
    const cs = getComputedStyle(el);
    const clips = ["hidden", "clip"].includes(cs.overflowX) || ["hidden", "clip"].includes(cs.overflow);
    if (clips && ownText(el) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis")
      add("med", "clipped-text", "text is cut off without an ellipsis", [sel(el)]);
  }

  // --- overlapping text -----------------------------------------------------
  const boxes = textEls.slice(0, 600).map((el) => [el, el.getBoundingClientRect()]);
  let overlaps = 0;
  for (let i = 0; i < boxes.length && overlaps < 6; i++) {
    for (let j = i + 1; j < boxes.length && overlaps < 6; j++) {
      const [a, ra] = boxes[i], [b, rb] = boxes[j];
      if (a.contains(b) || b.contains(a)) continue;
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 2 && y > 2 && x * y > 0.25 * Math.min(ra.width * ra.height, rb.width * rb.height)) {
        const floating = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed" || p === "sticky") return true; } return false; };
        if (floating(a) || floating(b)) continue;
        overlaps++;
        add("high", "overlap", "text elements overlap each other", [sel(a), sel(b)]);
      }
    }
  }

  // --- contrast -----------------------------------------------------------
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // gradient/image: can't judge
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.99) break;
      }
    }
    let out = { r: 255, g: 255, b: 255 };
    for (const c of layers.reverse()) out = {
      r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
    return out;
  };
  let lowContrast = 0;
  const lowList = [];
  for (const el of textEls) {
    if (el.disabled || el.closest("[aria-disabled=true]") || el.tagName === "INPUT" && !el.value) continue;
    if (!ownText(el) && !["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) continue; // icon-only button: no text to read
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = bgOf(el);
    if (!fg || !bg) continue;
    const mix = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const [l1, l2] = [lum(mix), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      lowContrast++;
      if (lowList.length < 5) lowList.push(`${sel(el)} ${ratio.toFixed(2)}:1`);
    }
  }
  if (lowContrast) add(lowContrast > 5 ? "high" : "med", "contrast",
    `${lowContrast} text element(s) below WCAG AA contrast`, lowList);

  // --- typography -----------------------------------------------------------
  const sizes = new Map(), families = new Set(), weights = new Set();
  let tiny = [];
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const fs = Math.round(parseFloat(cs.fontSize) * 2) / 2;
    sizes.set(fs, (sizes.get(fs) || 0) + 1);
    families.add(cs.fontFamily.split(",")[0].replace(/["']/g, "").trim());
    weights.add(cs.fontWeight);
    if (fs < 12 && tiny.length < 4) tiny.push(`${sel(el)} ${fs}px`);
  }
  if (tiny.length) add("med", "tiny-text", "text smaller than 12px", tiny);
  if (sizes.size > 9) add("low", "type-scale", `${sizes.size} different font sizes; use a scale of 5-7`,
    [[...sizes.keys()].sort((a, b) => a - b).join(", ")]);
  const fams = [...families];
  if (fams.some((f) => /^(Times New Roman|Times|serif)$/i.test(f)) && fams.length)
    add("high", "default-font", "some text renders in the browser default serif (font-family not set)", []);
  if (fams.length > 3) add("low", "font-families", `${fams.length} font families in use`, [fams.join(", ")]);

  // --- unstyled controls / default links -------------------------------------
  const rawButtons = all.filter((el) => {
    if (!["BUTTON", "INPUT", "SELECT"].includes(el.tagName)) return false;
    if (el.tagName === "INPUT" && ["checkbox", "radio", "range", "hidden", "color"].includes(el.type)) return false;
    const cs = getComputedStyle(el);
    return cs.backgroundColor === "rgb(239, 239, 239)" || cs.backgroundColor === "rgb(240, 240, 240)" ||
      (cs.borderStyle === "outset" || cs.borderTopStyle === "inset" && el.tagName === "INPUT");
  });
  if (rawButtons.length) add("med", "unstyled-control", `${rawButtons.length} control(s) use browser default styling`,
    rawButtons.slice(0, 4).map(sel));
  const rawLinks = all.filter((el) => el.tagName === "A" && getComputedStyle(el).color === "rgb(0, 0, 238)");
  if (rawLinks.length) add("med", "default-link", `${rawLinks.length} link(s) in default browser blue`, rawLinks.slice(0, 3).map(sel));

  // --- touch targets & form fields (mobile) -------------------------------------
  if (mobile) {
    const small = all.filter((el) => {
      if (!el.matches("a, button, input:not([type=hidden]), select, textarea, [role=button], [onclick]")) return false;
      const r = el.getBoundingClientRect();
      const inline = el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline";
      const labelled = el.matches("input") && el.closest("label") && el.closest("label").getBoundingClientRect().height >= 32;
      return !inline && !labelled && (r.height < 32 || r.width < 32);
    });
    if (small.length) add("med", "tap-target", `${small.length} tap target(s) smaller than 32px`,
      small.slice(0, 4).map((el) => { const r = el.getBoundingClientRect(); return `${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
    const zoomy = all.filter((el) => el.matches("input, select, textarea") && !choice(el) && parseFloat(getComputedStyle(el).fontSize) < 16);
    if (zoomy.length) add("low", "ios-zoom", "form fields under 16px font make iOS zoom on focus", zoomy.slice(0, 3).map(sel));
  }

  // --- readability -----------------------------------------------------------
  for (const el of all.filter((e) => e.tagName === "P").slice(0, 200)) {
    const cs = getComputedStyle(el);
    const chars = el.getBoundingClientRect().width / (parseFloat(cs.fontSize) * 0.5);
    if (chars > 95 && el.innerText.length > 160) {
      add("low", "line-length", `paragraph lines ~${Math.round(chars)} characters wide; aim for 60-80`, [sel(el)]);
      break;
    }
    const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    if (el.innerText.length > 120 && lh && lh < 1.3) {
      add("low", "line-height", `body text line-height ${lh.toFixed(2)}; use 1.4-1.7`, [sel(el)]);
      break;
    }
  }

  // --- content & assets -----------------------------------------------------------
  const body = document.body.innerText;
  if (/lorem ipsum/i.test(body)) add("med", "placeholder", "Lorem ipsum placeholder copy left in the page", []);
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0);
  if (broken.length) add("high", "broken-image", `${broken.length} image(s) failed to load`, broken.slice(0, 3).map((i) => i.src.slice(0, 80)));
  const emojiIcons = textEls.filter((el) => el.closest("nav, button, a, li, h1, h2, h3, [class*=icon]") &&
    /\p{Extended_Pictographic}/u.test([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")));
  if (emojiIcons.length >= 3) add("low", "emoji-icons", `${emojiIcons.length} emoji used as UI icons; prefer inline SVG icons`,
    emojiIcons.slice(0, 3).map(sel));
  const h1 = document.querySelectorAll("h1").length;
  if (h1 === 0) add("low", "headings", "no <h1> on the page", []);

  // --- layout bugs a human spots at a glance -----------------------------------------
  // Same nav labels visible twice near the top: usually a mobile menu rendering on desktop.
  const topLinks = all.filter((el) => el.matches("a, button") && el.getBoundingClientRect().top < 400 &&
    (el.innerText || "").trim().length > 1 && (el.innerText || "").trim().length < 30);
  const seen = new Map();
  for (const el of topLinks) { const t = el.innerText.trim().toLowerCase(); seen.set(t, (seen.get(t) || 0) + 1); }
  const dupes = [...seen].filter(([t, n]) => n > 1 && !/^(log ?in|sign ?in|sign ?up|get started|start free)/.test(t));
  if (dupes.length >= 2) add("high", "duplicate-nav", `navigation labels appear twice at the top (${dupes.slice(0, 4).map(([t]) => `"${t}"`).join(", ")}): a menu meant for another screen size is visible`, []);

  // Text squeezed into a sliver (collapsed table columns, flex items without min-width).
  const squeezed = textEls.filter((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
    const txt = (el.innerText || "").trim().replace(/\s+/g, " ");
    if (!ownText(el) || txt.length < 8) return false;
    // Count rendered line boxes of the element's own text, not height / line-height.
    const range = document.createRange();
    const tops = new Set();
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const rr of range.getClientRects()) if (rr.width > 0) tops.add(Math.round(rr.top));
    }
    const lines = tops.size;
    return lines >= 3 && txt.length / lines < 8;
  });
  if (squeezed.length) add("high", "squeezed-text", `${squeezed.length} text block(s) squeezed into a narrow column, wrapping almost every word`,
    squeezed.slice(0, 4).map((el) => `${sel(el)} ${Math.round(el.getBoundingClientRect().width)}px wide`));

  // Text running off the screen edge without a scroll container to reach it.
  const inScroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const offEdge = textEls.filter((el) => { const r = el.getBoundingClientRect(); return (r.right > vw + 2 || r.left < -2) && r.width < vw * 2 && !inScroller(el) && getComputedStyle(el).position !== "fixed"; });
  if (offEdge.length && docW <= vw + 1) add("high", "cut-off", `${offEdge.length} element(s) run off the screen edge and can't be reached (overflow is hidden)`,
    offEdge.slice(0, 4).map(sel));

  // Repeated axis/tick labels inside one chart.
  for (const svg of all.filter((el) => el.tagName === "svg")) {
    const labels = [...svg.querySelectorAll("text")].map((t) => t.textContent.trim()).filter(Boolean);
    const counts = labels.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());
    const rep = [...counts].filter(([t, n]) => n > 1 && /\d/.test(t));
    if (rep.length) { add("med", "chart-labels", `chart repeats axis labels (${rep.slice(0, 3).map(([t]) => `"${t}"`).join(", ")}): round ticks to distinct values`, [sel(svg)]); break; }
  }

  // Navigation/tab rows whose items are cut off.
  for (const el of all.filter((e) => e.matches("nav, header, [role=tablist], .tabs, .segmented, aside"))) {
    const cs = getComputedStyle(el);
    if (["hidden", "clip"].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) {
      add("med", "clipped-nav", "navigation/tab items are cut off; wrap them, shorten labels, or hide secondary items on small screens", [sel(el)]);
      break;
    }
    if (["auto", "scroll"].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && mobile) {
      const last = [...el.querySelectorAll("a, button")].pop();
      if (last && last.getBoundingClientRect().right > el.getBoundingClientRect().right + 2) {
        add("low", "scroll-nav", "navigation scrolls sideways on phones; make sure that's intended and the cut-off item is visibly partial", [sel(el)]);
        break;
      }
    }
  }

  // Overlays open on load.
  const overlays = all.filter((el) => el.matches("[role=dialog], dialog[open], .modal, .sheet, .bottom-sheet, .drawer, .overlay, .backdrop") &&
    el.getBoundingClientRect().height > 40);
  if (overlays.length) add("high", "overlay-open", "a dialog/sheet/overlay is visible on page load; hide it until the user opens it (display:none or [hidden])",
    overlays.slice(0, 3).map(sel));

  // Fixed/sticky bars covering the last content when scrolled to the bottom.
  const y0 = scrollY;
  scrollTo(0, document.documentElement.scrollHeight);
  const bars = all.filter((el) => getComputedStyle(el).position === "fixed").map((el) => [el, el.getBoundingClientRect()])
    .filter(([, r]) => r.width > vw * 0.3 || (r.width > 40 && r.height > 40));
  const covered = [];
  for (const [bar, br] of bars) {
    for (const el of textEls) {
      if (bar.contains(el) || el.closest("[style*=fixed]")) continue;
      let fixedAncestor = false;
      for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") { fixedAncestor = true; break; }
      if (fixedAncestor) continue;
      const r = el.getBoundingClientRect();
      const x = Math.min(r.right, br.right) - Math.max(r.left, br.left), y = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
      if (x > 4 && y > 4) covered.push(`${sel(el)} under ${sel(bar)}`);
    }
  }
  scrollTo(0, y0);
  if (covered.length) add("high", "covered-content", "fixed bar/button covers content at the end of the page: add bottom padding equal to its height",
    covered.slice(0, 3));

  // --- palette & spacing stats -------------------------------------------------------
  const colors = new Set(), bgs = new Set();
  const spacing = new Map();
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (ownText(el)) colors.add(cs.color);
    if (parse(cs.backgroundColor)?.a > 0) bgs.add(cs.backgroundColor);
    for (const p of ["paddingTop", "paddingLeft", "marginTop", "marginBottom", "rowGap", "columnGap"]) {
      const v = parseFloat(cs[p]);
      if (v > 0) spacing.set(v, (spacing.get(v) || 0) + 1);
    }
  }
  let onGrid = 0, total = 0;
  for (const [v, n] of spacing) { total += n; if (Math.abs(v / 4 - Math.round(v / 4)) < 0.01) onGrid += n; }
  const gridPct = total ? Math.round((100 * onGrid) / total) : 100;
  if (gridPct < 70) add("low", "spacing-grid", `only ${gridPct}% of spacing values sit on a 4px grid`, []);
  if (colors.size > 14) add("low", "text-colors", `${colors.size} distinct text colors; stick to 3-5 neutrals + accents`, []);

  const sorted = [...sizes.entries()].sort((a, b) => b[1] - a[1]);
  return {
    stats: {
      viewport: requested,
      pageHeight: document.documentElement.scrollHeight,
      textElements: textEls.length,
      fontSizes: [...sizes.keys()].sort((a, b) => a - b),
      bodySize: sorted[0]?.[0],
      fontFamilies: fams,
      fontWeights: [...weights].sort(),
      textColors: colors.size,
      backgroundColors: bgs.size,
      spacingOnGridPct: gridPct,
      svgIcons: document.querySelectorAll("svg").length,
      title: document.title,
    },
    issues,
  };
}

const report = { url, consoleErrors, views: [] };
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
for (const w of widths) {
  const h = w < 640 ? 844 : 900;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 640 });
  // Reset between widths so every load is a fresh navigation.
  const blank = once("Page.loadEventFired", 3000);
  await send("Page.navigate", { url: "about:blank" });
  await blank;
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  // A blocked main thread never answers; give fonts 5s and the audit 15s.
  const alive = await sendT("Runtime.evaluate", { expression: "1" }, 4000);
  if (!alive) { report.views.push(hung(w)); break; }
  await sendT("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true }, 5000);
  await sleep(700); // let entrance animations settle
  const r = await sendT("Runtime.evaluate", { expression: `(${auditInPage})(${w})`, returnByValue: true }, 15000);
  if (!r) { report.views.push(hung(w)); break; }
  const view = r.result?.result?.value || { stats: { viewport: w }, issues: [{ sev: "high", kind: "audit-failed", msg: JSON.stringify(r.result?.exceptionDetails || r.error) }] };
  report.views.push(view);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    const m = await send("Page.getLayoutMetrics");
    const H = Math.min(Math.ceil(m.result.cssContentSize.height), 7000);
    const s = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: H, scale: 1 } });
    const f = join(shots, `${w}.png`);
    writeFileSync(f, Buffer.from(s.result.data, "base64"));
    view.screenshot = f;
  }
  if (views) {
    // Screen-sized chunks (a vision model reads these far better than one tall image).
    mkdirSync(views, { recursive: true });
    const m = await send("Page.getLayoutMetrics");
    const total = Math.ceil(m.result.cssContentSize.height);
    const tag = w < 640 ? "mobile" : "desktop";
    const max = w < 640 ? 3 : 2;
    view.views = [];
    // Scroll the real viewport and capture what a person would see: full-page captures
    // draw fixed/sticky bars in the wrong place and invent overlaps that aren't there.
    const stops = [];
    for (let i = 0; i < max && i * h < total; i++) stops.push(Math.min(i * h, Math.max(0, total - h)));
    if (stops.length < max && total > h) stops[stops.length - 1] = total - h;
    for (let i = 0; i < stops.length; i++) {
      await send("Runtime.evaluate", { expression: `scrollTo(0, ${stops[i]})` });
      await sleep(250);
      const s = await send("Page.captureScreenshot", { format: "png" });
      const f = join(views, `${tag}-${i + 1}.png`);
      writeFileSync(f, Buffer.from(s.result.data, "base64"));
      view.views.push(f);
    }
  }
}
clearTimeout(WATCHDOG);
ws.close();
chrome.kill("SIGKILL");
await sleep(200);
rmSync(profile, { recursive: true, force: true });

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const errs = [...new Set(report.consoleErrors)];
  console.log(`ui-audit ${url}`);
  if (errs.length) console.log(`\nJS/console errors (${errs.length}):\n` + errs.slice(0, 6).map((e) => `  - ${e}`).join("\n"));
  for (const v of report.views) {
    const s = v.stats;
    if (s.pageHeight === undefined) {
      console.log(`\n== ${s.viewport}px wide`);
    } else {
      console.log(`\n== ${s.viewport}px wide · page ${s.pageHeight}px tall · ${s.textElements} text elements`);
      console.log(`   type: sizes ${s.fontSizes?.join("/")} (body ${s.bodySize}px) · families ${s.fontFamilies?.join(", ")} · weights ${s.fontWeights?.join("/")}`);
      console.log(`   color: ${s.textColors} text colors, ${s.backgroundColors} backgrounds · spacing on 4px grid: ${s.spacingOnGridPct}% · svg icons: ${s.svgIcons}`);
    }
    if (!v.issues.length) console.log("   no issues found");
    const order = { high: 0, med: 1, low: 2 };
    for (const i of v.issues.sort((a, b) => order[a.sev] - order[b.sev])) {
      console.log(`   [${i.sev}] ${i.kind}: ${i.msg}`);
      for (const w of (i.where || []).slice(0, 4)) console.log(`          · ${w}`);
    }
  }
  const counts = report.views.flatMap((v) => v.issues).reduce((a, i) => ((a[i.sev] = (a[i.sev] || 0) + 1), a), {});
  console.log(`\nsummary: ${counts.high || 0} high, ${counts.med || 0} medium, ${counts.low || 0} low` +
    (errs.length ? `, ${errs.length} console error(s)` : ""));
  const pics = report.views.flatMap((v) => v.views || []);
  if (pics.length) console.log(`\nscreenshots (open each with the read tool and review them):\n` + pics.map((f) => `  ${f}`).join("\n"));
}

// Pending load-event timeouts would otherwise keep Node alive.
process.exit(0);
