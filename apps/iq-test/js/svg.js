// svg.js — self-generated figure renderer (zero external assets)
// All figures are drawn in a 0..100 coordinate space.
(function (global) {
  'use strict';

  function polyPoints(n, r, cx, cy, rotDeg) {
    const pts = [];
    const rot = (rotDeg || 0) * Math.PI / 180 - Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = rot + (i * 2 * Math.PI) / n;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  function starPoints(spikes, rOut, rIn, cx, cy, rotDeg) {
    const pts = [];
    const rot = (rotDeg || 0) * Math.PI / 180 - Math.PI / 2;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? rOut : rIn;
      const a = rot + (i * Math.PI) / spikes;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  // dot ring: k dots arranged around center
  function dotRing(k, cx, cy, rad, dr) {
    let s = '';
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / k;
      s += `<circle cx="${(cx + rad * Math.cos(a)).toFixed(2)}" cy="${(cy + rad * Math.sin(a)).toFixed(2)}" r="${dr}" class="fg"/>`;
    }
    return s;
  }

  const STROKE = 'var(--cyan)';

  function prim(p) {
    switch (p.t) {
      case 'poly':
        return `<polygon points="${polyPoints(p.n, p.r || 30, p.cx || 50, p.cy || 50, p.rot)}"
          fill="${p.fill || 'none'}" stroke="${p.stroke || STROKE}" stroke-width="${p.sw || 3}" stroke-linejoin="round"/>`;
      case 'star':
        return `<polygon points="${starPoints(p.n || 5, p.r || 30, (p.r || 30) * 0.45, p.cx || 50, p.cy || 50, p.rot)}"
          fill="${p.fill || 'none'}" stroke="${p.stroke || STROKE}" stroke-width="${p.sw || 3}" stroke-linejoin="round"/>`;
      case 'circ':
        return `<circle cx="${p.cx || 50}" cy="${p.cy || 50}" r="${p.r || 30}"
          fill="${p.fill || 'none'}" stroke="${p.stroke || STROKE}" stroke-width="${p.sw || 3}"/>`;
      case 'dot':
        return `<circle cx="${p.cx || 50}" cy="${p.cy || 50}" r="${p.r || 4}" class="fg"/>`;
      case 'dots': // k dots in a ring
        return dotRing(p.k, p.cx || 50, p.cy || 50, p.rad || 14, p.r || 4);
      case 'line':
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke || STROKE}" stroke-width="${p.sw || 3}" stroke-linecap="round"/>`;
      case 'arrow': { // arrow from center pointing at angle deg (0=up), length l
        const a = ((p.rot || 0) - 90) * Math.PI / 180;
        const l = p.l || 26, cx = p.cx || 50, cy = p.cy || 50;
        const x2 = cx + l * Math.cos(a), y2 = cy + l * Math.sin(a);
        const ha = 26 * Math.PI / 180;
        const hx = x2 - 12 * Math.cos(a - ha), hy = y2 - 12 * Math.sin(a - ha);
        const hx2 = x2 - 12 * Math.cos(a + ha), hy2 = y2 - 12 * Math.sin(a + ha);
        return `<g stroke="${p.stroke || STROKE}" stroke-width="${p.sw || 4}" stroke-linecap="round" fill="none">
          <line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}"/>
          <polyline points="${hx.toFixed(1)},${hy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${hx2.toFixed(1)},${hy2.toFixed(1)}"/></g>`;
      }
      case 'lshape': { // L-tromino block, rot in 90deg steps, mirror flag
        const m = p.mirror ? -1 : 1;
        const pts = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [0, 2]].map(([x, y]) => [m * x, y]);
        const s = p.s || 16, cx = p.cx || 50, cy = p.cy || 50;
        const rot = ((p.rot || 0) % 360) * Math.PI / 180;
        const path = pts.map(([x, y]) => {
          const rx = x * Math.cos(rot) - y * Math.sin(rot);
          const ry = x * Math.sin(rot) + y * Math.cos(rot);
          return (cx + rx * s).toFixed(1) + ',' + (cy + ry * s).toFixed(1);
        }).join(' ');
        return `<polygon points="${path}" fill="${p.fill || 'rgba(38,229,255,.18)'}" stroke="${p.stroke || STROKE}" stroke-width="3" stroke-linejoin="round"/>`;
      }
      case 'txt':
        return `<text x="${p.cx || 50}" y="${p.cy || 56}" text-anchor="middle" class="svg-txt"
          style="font-size:${p.fs || 26}px">${p.v}</text>`;
      case 'grid': // faint 2x2 fold grid
        return `<g stroke="var(--line)" stroke-width="2" stroke-dasharray="4 4">
          <line x1="50" y1="10" x2="50" y2="90"/><line x1="10" y1="50" x2="90" y2="50"/></g>`;
      case 'sheet': // square sheet outline
        return `<rect x="10" y="10" width="80" height="80" fill="rgba(122,86,255,.10)" stroke="var(--pink)" stroke-width="3"/>`;
      default:
        return '';
    }
  }

  function cell(prims, opts) {
    opts = opts || {};
    const inner = (prims || []).map(prim).join('');
    return `<svg viewBox="0 0 100 100" class="fig${opts.q ? ' qcell' : ''}" role="img">${inner}</svg>`;
  }

  global.SVG = { cell, polyPoints, dotRing };
})(window);
