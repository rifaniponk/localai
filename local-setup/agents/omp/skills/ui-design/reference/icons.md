# Inline SVG icons (24x24 line icons, Lucide style)

Wrap every path below in this exact element; size with width/height (16 in buttons, 18 in nav, 20 in headers),
color with CSS `color` (the stroke is `currentColor`):

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">PATHS</svg>
```

For icon-only buttons add `aria-label` on the button. Keep one stroke width (2) everywhere.

| name | PATHS |
|---|---|
| home | `<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>` |
| dashboard | `<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>` |
| bar-chart | `<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>` |
| activity | `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>` |
| trending-up | `<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>` |
| trending-down | `<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>` |
| users | `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>` |
| user | `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>` |
| settings | `<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>` |
| bell | `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>` |
| search | `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>` |
| filter | `<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>` |
| plus | `<path d="M12 5v14M5 12h14"/>` |
| check | `<path d="M20 6 9 17l-5-5"/>` |
| x | `<path d="M18 6 6 18M6 6l12 12"/>` |
| chevron-right | `<path d="m9 18 6-6-6-6"/>` |
| chevron-down | `<path d="m6 9 6 6 6-6"/>` |
| arrow-right | `<path d="M5 12h14M13 5l7 7-7 7"/>` |
| arrow-up-right | `<path d="M7 17 17 7M7 7h10v10"/>` |
| more | `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>` |
| menu | `<path d="M4 6h16M4 12h16M4 18h16"/>` |
| mail | `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>` |
| message | `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` |
| inbox | `<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>` |
| lock | `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>` |
| shield | `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>` |
| credit-card | `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>` |
| dollar | `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` |
| cart | `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>` |
| package | `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>` |
| calendar | `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>` |
| clock | `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>` |
| flame | `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>` |
| star | `<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>` |
| zap | `<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>` |
| trash | `<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>` |
| pencil | `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>` |
| download | `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>` |
| log-out | `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>` |
| alert | `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>` |
| info | `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>` |
| globe | `<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>` |
| server | `<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>` |
| sun | `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>` |
| moon | `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>` |

Logo mark idea: a 28-32px rounded square in `var(--accent)` with one white icon inside, plus the
product name in 600 weight next to it.
