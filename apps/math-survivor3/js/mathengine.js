/* ============================================================
   Math engine — tiered curriculum generator + expression matching
   Tiers unlock by wave:
     I    add / subtract within 20
     II   add / subtract within 50, ×-tables 2..9
     III  exact ÷, mixed two-operand
     IV   two-step, order of operations (a + b×c, (a+b)−c …)
     V    squares, big two-step, everything combined
   Every expression is emitted as { text, value } with value ≥ 0.
   ============================================================ */

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const MUL = '×', DIV = '÷', MIN = '−';

/* --- atom generators per tier --------------------------------- */

function genTier1() {
  const a = ri(2, 12), b = ri(1, 9);
  return Math.random() < 0.55
    ? { text: `${a}+${b}`, value: a + b }
    : { text: `${Math.max(a, b) + b}${MIN}${b}`, value: Math.max(a, b) };
}

function genTier2() {
  const r = Math.random();
  if (r < 0.4) {
    const a = ri(2, 9), b = ri(2, 9);
    return { text: `${a}${MUL}${b}`, value: a * b };
  }
  if (r < 0.7) {
    const a = ri(12, 40), b = ri(3, 20);
    return { text: `${a + b}${MIN}${b}`, value: a };
  }
  const a = ri(6, 35), b = ri(4, 25);
  return { text: `${a}+${b}`, value: a + b };
}

function genTier3() {
  const r = Math.random();
  if (r < 0.4) {
    const b = ri(2, 9), q = ri(2, 9);
    return { text: `${b * q}${DIV}${b}`, value: q };
  }
  if (r < 0.7) {
    const a = ri(3, 9), b = ri(3, 9), c = ri(2, 12);
    return Math.random() < 0.5
      ? { text: `${a}${MUL}${b}${MIN}${c}`, value: a * b - c }
      : { text: `${a}${MUL}${b}+${c}`, value: a * b + c };
  }
  const a = ri(25, 60), b = ri(15, 45);
  return { text: `${a}${MIN}${b}`, value: a - b };
}

function genTier4() {
  const r = Math.random();
  if (r < 0.35) {
    // a + b×c  (order of operations!)
    const a = ri(2, 15), b = ri(2, 9), c = ri(2, 9);
    return { text: `${a}+${b}${MUL}${c}`, value: a + b * c };
  }
  if (r < 0.6) {
    // (a+b)×c
    const a = ri(2, 9), b = ri(2, 9), c = ri(2, 6);
    return { text: `(${a}+${b})${MUL}${c}`, value: (a + b) * c };
  }
  if (r < 0.8) {
    // a×b − c
    const a = ri(4, 9), b = ri(4, 9), c = ri(2, 18);
    return { text: `${a}${MUL}${b}${MIN}${c}`, value: a * b - c };
  }
  // b×q ÷ b style chain
  const b = ri(2, 8), q = ri(3, 9);
  return { text: `${b * q}${DIV}${b}`, value: q };
}

function genTier5() {
  const r = Math.random();
  if (r < 0.25) {
    const a = ri(3, 12);
    return { text: `${a}\u00B2`, value: a * a };
  }
  if (r < 0.5) {
    const a = ri(3, 9), b = ri(3, 9), c = ri(2, 9);
    const inner = a * b - c >= 0 ? `${a}${MUL}${b}${MIN}${c}` : `${a}${MUL}${b}+${c}`;
    return { text: `(${inner})${MUL}${c}`, value: (a * b - c >= 0 ? a * b - c : a * b + c) * c };
  }
  if (r < 0.75) {
    const b = ri(3, 9), q = ri(3, 9), c = ri(2, 15);
    return { text: `${b * q}${DIV}${b}+${c}`, value: q + c };
  }
  const a = ri(6, 12), b = ri(4, 9), c = ri(1, 9);
  return Math.random() < 0.5
    ? { text: `${a}${MUL}${b}${MIN}${c}`, value: a * b - c }
    : { text: `${a}${MUL}${b}+${c}`, value: a * b + c };
}

const TIER_GENS = [genTier1, genTier2, genTier3, genTier4, genTier5];
const TIER_NAMES = ['TIER I', 'TIER II', 'TIER III', 'TIER IV', 'TIER V'];
const TIER_SUBS = ['the arena stirs', 'sharper sigils', 'tables turn', 'order of operations', 'the titan wakes'];

export function tierIndex(wave) {
  return Math.min(4, Math.floor((wave - 1) / 4));
}

export function tierName(wave) {
  return TIER_NAMES[tierIndex(wave)];
}

export function tierSub(wave) {
  return TIER_SUBS[tierIndex(wave)];
}

/* --- batch generation with value diversity -------------------- */

export function generateBatch(wave, count) {
  const gen = TIER_GENS[tierIndex(wave)];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    let q = gen(), tries = 0;
    // keep values varied within a wave, but allow occasional repeats
    while (seen.has(q.value) && tries < 8) { q = gen(); tries++; }
    seen.add(q.value);
    out.push(q);
  }
  return out;
}

/* parse the player's console input: digits, optional leading minus */
export function parseAnswer(str) {
  const s = str.trim();
  if (s === '' || s === '-') return null;
  if (!/^-?\d+$/.test(s)) return null;
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
}

export const MathEngine = { generateBatch, parseAnswer, tierName, tierSub, tierIndex };
