/* Math Survivor — procedural question generator (pure logic, DOM-free, node-testable).
 * Grades 1-6 define the CURRICULUM boundary; tier 1-5 scales difficulty WITHIN a grade.
 * Every question: { display, answer, op, grade, tier } with integer answers, |answer| <= 999.
 */
const MGQ = (function () {
  "use strict";

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clampTier(t) { return Math.max(1, Math.min(5, t | 0 || 1)); }

  // ---- per-grade generators; each returns {display, answer, op} or null to retry ----

  function addG1(t) { const m = [6, 10, 15, 20, 30][t - 1]; const a = ri(1, m), b = ri(1, m); return { display: a + " + " + b, answer: a + b, op: "addition" }; }
  function subG1(t) { const m = [6, 10, 15, 20, 30][t - 1]; const a = ri(2, m), b = ri(1, a); return { display: a + " - " + b, answer: a - b, op: "subtraction" }; }

  function addG2(t) { const m = [20, 30, 45, 60, 90][t - 1]; const a = ri(5, m), b = ri(5, m); return { display: a + " + " + b, answer: a + b, op: "addition" }; }
  function subG2(t) { const m = [25, 40, 55, 75, 99][t - 1]; const a = ri(10, m), b = ri(5, a); return { display: a + " - " + b, answer: a - b, op: "subtraction" }; }
  function mulTable(maxF) { const a = ri(2, maxF), b = ri(2, maxF); return { a, b }; }
  function mulG2(t) { const { a, b } = mulTable([4, 5, 6, 8, 10][t - 1]); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" }; }
  function divG2(t) { const { a, b } = mulTable([4, 5, 6, 8, 10][t - 1]); return { display: (a * b) + " \u00F7 " + b, answer: a, op: "division" }; }

  function addG3(t) { const m = [80, 120, 160, 220, 300][t - 1]; const a = ri(15, m), b = ri(15, m); return { display: a + " + " + b, answer: a + b, op: "addition" }; }
  function subG3(t) { const m = [90, 140, 190, 250, 350][t - 1]; const a = ri(40, m), b = ri(10, a); return { display: a + " - " + b, answer: a - b, op: "subtraction" }; }
  function mulG3(t) { const { a, b } = mulTable([6, 8, 10, 11, 12][t - 1]); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" }; }
  function divG3(t) { const { a, b } = mulTable([6, 8, 10, 11, 12][t - 1]); return { display: (a * b) + " \u00F7 " + b, answer: a, op: "division" }; }

  function mulG4(t) {
    if (t <= 2) { const a = ri(11, 19), b = ri(2, 5); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" }; }
    const a = ri(12, 29), b = ri(3, 9); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" };
  }
  function divG4(t) {
    const b = ri(6, 12), q = ri(3, [6, 8, 10, 12, 12][t - 1]);
    return { display: (b * q) + " \u00F7 " + b, answer: q, op: "division" };
  }
  function mixedG4(t) {
    // a + b x c  /  a - b x c  /  (a + b) x c   — readable, order of operations respected
    const style = t >= 3 ? ri(0, 2) : ri(0, 1);
    if (style === 0) { const a = ri(10, 60), b = ri(2, 8), c = ri(2, 8); return { display: a + " + " + b + " \u00D7 " + c, answer: a + b * c, op: "mixed" }; }
    if (style === 1) { const b = ri(2, 6), c = ri(2, 6), a = ri(b * c + 5, 90); return { display: a + " - " + b + " \u00D7 " + c, answer: a - b * c, op: "mixed" }; }
    const a = ri(3, 15), b = ri(3, 15), c = ri(2, 6); return { display: "(" + a + " + " + b + ") \u00D7 " + c, answer: (a + b) * c, op: "mixed" };
  }

  function pctG5(t) {
    const p = pick(t <= 2 ? [10, 20, 50] : [10, 20, 25, 50, 75]);
    const n = pick([20, 40, 60, 80, 100, 120, 160, 200]);
    return { display: p + "% of " + n, answer: (p * n) / 100, op: "percent" };
  }
  function mulG5(t) { const a = ri(11, [14, 16, 19, 24, 29][t - 1]), b = ri(11, 19); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" }; }
  function divG5(t) { const b = ri(4, 16), q = ri(5, 15); return { display: (b * q) + " \u00F7 " + b, answer: q, op: "division" }; }
  function mixedG5(t) {
    const style = ri(0, 1);
    if (style === 0) { const a = ri(8, 60), b = ri(2, 9), c = ri(2, 9); return { display: a + " + " + b + " \u00D7 " + c, answer: a + b * c, op: "mixed" }; }
    const a = ri(2, 12), b = ri(2, 12), c = ri(2, 9), d = ri(2, 9); return { display: a + " \u00D7 " + b + " + " + c + " \u00D7 " + d, answer: a * b + c * d, op: "mixed" };
  }

  function pctG6(t) {
    const p = pick([5, 15, 20, 25, 30, 40, 60, 75]);
    const n = pick([20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 240]);
    const ans = (p * n) / 100;
    if (!Number.isInteger(ans)) return null;
    return { display: p + "% of " + n, answer: ans, op: "percent" };
  }
  function negG6(t) {
    const a = ri(2, 20), b = ri(a + 1, 30);
    if (ri(0, 1) === 0) return { display: a + " - " + b, answer: a - b, op: "negative" };
    return { display: "-" + b + " + " + a, answer: a - b, op: "negative" };
  }
  function mixedG6(t) {
    const style = ri(0, 2);
    if (style === 0) { const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9); return { display: a + " + " + b + " \u00D7 " + c, answer: a + b * c, op: "mixed" }; }
    if (style === 1) { const b = ri(2, 9), q = ri(3, 15), c = ri(2, 20); return { display: (b * q) + " \u00F7 " + b + " + " + c, answer: q + c, op: "mixed" }; }
    const a = ri(3, 12), b = ri(3, 12), c = ri(2, 5); return { display: "(" + a + " + " + b + ") \u00D7 " + c, answer: (a + b) * c, op: "mixed" };
  }
  function mulG6(t) { const a = ri(12, 25), b = ri(12, 19); return { display: a + " \u00D7 " + b, answer: a * b, op: "multiplication" }; }

  const OPS = {
    1: [addG1, subG1],
    2: [addG2, subG2, mulG2, divG2],
    3: [addG3, subG3, mulG3, divG3],
    4: [mulG4, divG4, mixedG4, addG3, subG3],
    5: [pctG5, mulG5, divG5, mixedG5],
    6: [pctG6, negG6, mixedG6, mulG6, divG5]
  };

  function validate(q) {
    if (!q || typeof q.display !== "string" || !q.display.length) return false;
    if (!Number.isFinite(q.answer) || !Number.isInteger(q.answer)) return false;
    if (Math.abs(q.answer) > 999) return false;
    if (/[0-9]\s*\/\s*[0-9]/.test(q.display)) return false; // no fractional display
    if (/NaN|Infinity|undefined/.test(q.display)) return false;
    if (q.grade >= 1 && q.grade <= 5 && q.answer < 0) return false; // negatives only grade 6
    return true;
  }

  /** Generate one question for grade (1-6) and tier (1-5). */
  function make(grade, tier) {
    grade = Math.max(1, Math.min(6, grade | 0 || 1));
    tier = clampTier(tier);
    const pool = OPS[grade];
    for (let tries = 0; tries < 40; tries++) {
      const q = pick(pool)(tier);
      if (q && validate(q)) { q.grade = grade; q.tier = tier; return q; }
    }
    // guaranteed fallback: simple addition in grade range
    const a = ri(1, 9 * grade), b = ri(1, 9 * grade);
    const q = { display: a + " + " + b, answer: a + b, op: "addition", grade, tier };
    return q;
  }

  /** Dev test: generate n samples per grade, validate every one. Returns report. */
  function batchTest(n) {
    const report = {};
    for (let g = 1; g <= 6; g++) {
      let ok = 0, bad = 0, min = Infinity, max = -Infinity;
      const seenOps = new Set();
      for (let i = 0; i < n; i++) {
        const tier = 1 + (i % 5);
        const q = make(g, tier);
        if (validate(q)) { ok++; seenOps.add(q.op); min = Math.min(min, q.answer); max = Math.max(max, q.answer); }
        else { bad++; if (bad <= 3) console.error("BAD q grade " + g + ":", JSON.stringify(q)); }
      }
      report["grade" + g] = { ok, bad, minAnswer: min, maxAnswer: max, ops: [...seenOps].sort() };
    }
    return report;
  }

  return { make, validate, batchTest };
})();

if (typeof module !== "undefined" && module.exports) module.exports = MGQ;
if (typeof window !== "undefined") window.MGQ = MGQ;
