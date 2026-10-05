// scoring.js — 1PL (Rasch) IRT scoring on a true IQ scale (DOM-free)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.IQSCORE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SD = 15, MEAN = 100;

  function p(theta, b) { return 1 / (1 + Math.exp(-(theta - b))); }

  // MLE of theta with a mild N(0,1) prior (MAP), Newton steps
  function estimate(items, responses) {
    let theta = 0;
    for (let iter = 0; iter < 40; iter++) {
      let g = -theta / 1;         // prior gradient
      let h = -1;                 // prior curvature
      for (let i = 0; i < items.length; i++) {
        const pi = p(theta, items[i].b);
        const u = responses[i] ? 1 : 0;
        g += (u - pi);
        h -= pi * (1 - pi);
      }
      const step = g / h;
      theta -= step;
      if (!isFinite(theta)) theta = 0;
      theta = Math.max(-4, Math.min(4, theta));
      if (Math.abs(step) < 1e-6) break;
    }
    let info = 1; // prior information
    for (const it of items) { const pi = p(theta, it.b); info += pi * (1 - pi); }
    const se = 1 / Math.sqrt(info);
    return { theta, se };
  }

  function classify(iq) {
    if (iq >= 130) return { label: 'GIFTED', note: 'Top ~2% of the population.', color: 'var(--yellow)' };
    if (iq >= 120) return { label: 'SUPERIOR', note: 'Top ~9% of the population.', color: 'var(--cyan)' };
    if (iq >= 110) return { label: 'ABOVE AVERAGE', note: 'Sharper than most.', color: 'var(--cyan)' };
    if (iq >= 90) return { label: 'AVERAGE', note: 'Right in the healthy middle of the bell curve.', color: 'var(--pink)' };
    if (iq >= 80) return { label: 'LOW AVERAGE', note: 'A little below the middle.', color: 'var(--pink)' };
    return { label: 'BELOW AVERAGE', note: 'Try again well-rested — speed hurts.', color: 'var(--muted)' };
  }

  function score(items, responses) {
    const { theta, se } = estimate(items, responses);
    const iq = Math.round(MEAN + SD * theta);
    const lo = Math.round(MEAN + SD * (theta - 1.96 * se));
    const hi = Math.round(MEAN + SD * (theta + 1.96 * se));
    const perCat = {};
    items.forEach((it, i) => {
      const c = perCat[it.cat] = perCat[it.cat] || { n: 0, ok: 0 };
      c.n++; c.ok += responses[i] ? 1 : 0;
    });
    return { iq, lo, hi, se, theta, classify: classify(iq), perCat,
      raw: responses.filter(Boolean).length, total: items.length };
  }

  return { score, estimate, classify, p };
});
