/* Math Dungeon — procedural question generator (grade 1-6 curriculum, adaptive tier).
   Pure logic, DOM-free: also require()-able in node for automated validation. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});

  const rnd = n => Math.floor(Math.random() * n);
  const ri = (a, b) => a + rnd(b - a + 1);
  const pick = a => a[rnd(a.length)];
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- distractors: plausible near-misses, never nonsense ----------
  function distractors(ans, cands) {
    const set = new Set();
    for (const c of cands) if (Number.isFinite(c) && c !== ans && (ans < 0 || c >= 0)) set.add(c);
    let s = 1;
    while (set.size < 3 && s <= 14) {
      for (const d of [s, -s, s * 2, -s * 2, s * 10, -s * 10]) {
        const v = ans + d;
        if (v !== ans && (ans < 0 || v >= 0)) set.add(v);
        if (set.size >= 3) break;
      }
      s++;
    }
    return Array.from(set).slice(0, 3);
  }
  function mc(cat, prompt, ans, extra, explain) {
    const choices = shuffle([ans].concat(distractors(ans, extra || [])));
    return { category: cat, mode: 'mc', prompt, answer: ans, choices, explain };
  }
  function inp(cat, prompt, ans, explain) {
    return { category: cat, mode: 'input', prompt, answer: ans, explain };
  }
  function tf(cat, prompt, isTrue, explain) {
    return { category: cat, mode: 'mc', prompt, answer: isTrue ? 'True' : 'False', choices: shuffle(['True', 'False']), explain };
  }
  function frac(n, d) { return '<span class="frac"><i>' + n + '</i><i>' + d + '</i></span>'; }

  // ---------- builders: (tier 1..3) -> question ----------
  const B = {};

  B.counting = t => {
    const n = ri(3, 5 + t * 3);
    const icon = pick(['coin', 'gem', 'potion', 'shield']);
    return mc('counting', 'Count the treasures!', n, [n - 1, n + 1, n + 2, n - 2], 'There are ' + n + ' ' + icon + 's.');
  };
  B.counting.visual = null;

  function addRange(t) { return t === 1 ? [1, 9] : t === 2 ? [2, 15] : [3, 20]; }
  B.add1 = t => { const [a0, a1] = addRange(t); const a = ri(a0, a1), b = ri(a0, a1); return mc('addition', a + ' + ' + b + ' = ?', a + b, [a + b + 1, a + b - 1, a + b + 2], a + ' + ' + b + ' = ' + (a + b)); };
  B.sub1 = t => { const [a0, a1] = addRange(t); let a = ri(a0 + 1, a1 + 5), b = ri(1, Math.min(a, a1)); return mc('subtraction', a + ' \u2212 ' + b + ' = ?', a - b, [a - b + 1, a - b - 1, a - b + 2], a + ' \u2212 ' + b + ' = ' + (a - b)); };
  B.compare = () => {
    let a = ri(1, 20), b = a; while (b === a) b = ri(1, 20);
    const big = Math.max(a, b);
    return { category: 'compare', mode: 'mc', prompt: 'Which number is bigger?', answer: big, choices: shuffle([a, b]), explain: big + ' is bigger than ' + Math.min(a, b) + '.' };
  };
  B.missing1 = t => {
    const [a0, a1] = addRange(t); const a = ri(a0, a1), x = ri(1, a1); const c = a + x;
    if (rnd(2)) return inp('missing', a + ' + ? = ' + c, x, a + ' + ' + x + ' = ' + c);
    return mc('missing', '? + ' + a + ' = ' + c, x, [x + 1, x - 1, c - a + 2], a + ' + ' + x + ' = ' + c);
  };
  B.sequence1 = t => {
    const step = pick(t === 1 ? [1, 2, 5, 10] : [2, 3, 4, 5, 10]);
    const start = ri(1, 10);
    const seq = [start, start + step, start + 2 * step, start + 3 * step];
    const ans = start + 4 * step;
    return mc('sequences', 'What comes next?  ' + seq.join(', ') + ', ?', ans, [ans + step, ans - step, ans + 1], 'It goes up by ' + step + ' each time: ' + ans + '.');
  };
  B.tf1 = t => {
    const [a0, a1] = addRange(t); const a = ri(a0, a1), b = ri(a0, a1); const real = a + b;
    const shown = rnd(2) ? real : real + pick([-2, -1, 1, 2]);
    return tf('truefalse', a + ' + ' + b + ' = ' + shown, shown === real, a + ' + ' + b + ' = ' + real + '.');
  };

  B.add2 = t => { const hi = t === 1 ? 39 : t === 2 ? 69 : 99; const a = ri(11, hi), b = ri(11, hi); return mc('addition', a + ' + ' + b + ' = ?', a + b, [a + b + 10, a + b - 10, a + b + 1], a + ' + ' + b + ' = ' + (a + b)); };
  B.sub2 = t => { const hi = t === 1 ? 49 : t === 2 ? 79 : 99; const a = ri(21, hi), b = ri(11, a - 1); return mc('subtraction', a + ' \u2212 ' + b + ' = ?', a - b, [a - b + 10, a - b - 10, a - b + 1], a + ' \u2212 ' + b + ' = ' + (a - b)); };
  B.groups = t => {
    const g = ri(3, 4 + t), v = pick([2, 5, 10]); const ans = g * v;
    return mc('multiplication', v + ' + ' + v + ' + ' + Array(g - 2).fill(v).join(' + ') + ' = ?', ans, [ans + v, ans - v, ans + 1], g + ' groups of ' + v + ' make ' + ans + '.');
  };
  B.share = t => {
    const d = pick([2, 3, 4, 5]); const q = ri(2, 5 + t * 2); const total = d * q;
    return inp('division', 'Share ' + total + ' coins equally between ' + d + ' heroes. Each gets?', q, total + ' \u00f7 ' + d + ' = ' + q + ' coins each.');
  };
  B.placevalue = () => {
    const h = ri(1, 9), te = ri(0, 9), o = ri(0, 9);
    const digits = [h, te, o].map((v, i) => ({ v, i })).filter(x => x.v > 0);
    const d = pick(digits);
    const num = h * 100 + te * 10 + o;
    const val = d.v * Math.pow(10, 2 - d.i);
    return mc('placevalue', 'What is the value of the digit ' + d.v + ' in ' + num + '?', val, [d.v, d.v * 10, d.v * 100], d.v + ' is in the ' + (d.i === 0 ? 'hundreds' : d.i === 1 ? 'tens' : 'ones') + ' place, so it is worth ' + val + '.');
  };
  B.word2 = t => {
    const a = ri(10, 40), b = ri(5, 20);
    if (rnd(2)) return inp('word', 'A knight finds ' + a + ' coins. He gives ' + b + ' to a friend. How many coins are left?', a - b, a + ' \u2212 ' + b + ' = ' + (a - b) + ' coins.');
    return inp('word', 'A hero collects ' + a + ' coins on Monday and ' + b + ' on Tuesday. How many coins in total?', a + b, a + ' + ' + b + ' = ' + (a + b) + ' coins.');
  };

  B.mul3 = t => { const a = ri(t === 1 ? 2 : 3, t === 3 ? 12 : 9), b = ri(2, 9); return mc('multiplication', a + ' \u00d7 ' + b + ' = ?', a * b, [a * b + a, a * b - b, a * b + 10, a * b - 10], a + ' \u00d7 ' + b + ' = ' + a * b); };
  B.div3 = t => { const b = ri(2, 9); const q = ri(2, t === 3 ? 12 : 9); return mc('division', b * q + ' \u00f7 ' + b + ' = ?', q, [q + 1, q - 1, b, q + 2], b * q + ' \u00f7 ' + b + ' = ' + q); };
  B.fracOf = t => {
    const d = pick([2, 3, 4]); const whole = d * ri(2, 4 + t * 2);
    return inp('fractions', '1/' + d + ' of ' + whole + ' = ?', whole / d, whole + ' split into ' + d + ' equal parts gives ' + whole / d + '.');
  };
  B.addBig = t => { const hi = t === 1 ? 299 : t === 2 ? 499 : 999; const a = ri(100, hi), b = ri(100, hi); return mc('addition', a + ' + ' + b + ' = ?', a + b, [a + b + 100, a + b - 100, a + b + 10], a + ' + ' + b + ' = ' + (a + b)); };
  B.subBig = t => { const hi = t === 1 ? 399 : t === 2 ? 599 : 999; const a = ri(200, hi), b = ri(100, a - 1); return mc('subtraction', a + ' \u2212 ' + b + ' = ?', a - b, [a - b + 100, a - b - 10, a - b + 1], a + ' \u2212 ' + b + ' = ' + (a - b)); };
  B.areaRect = t => { const w = ri(3, 6 + t * 2), h = ri(3, 6 + t); return inp('geometry', 'A treasure room is ' + w + ' tiles long and ' + h + ' tiles wide. What is its area (in square tiles)?', w * h, w + ' \u00d7 ' + h + ' = ' + w * h + ' square tiles.'); };
  B.perim = t => { const w = ri(3, 8), h = ri(3, 6 + t); return inp('geometry', 'A fence around a ' + w + ' by ' + h + ' garden. What is the perimeter?', 2 * (w + h), 'Perimeter = ' + w + ' + ' + w + ' + ' + h + ' + ' + h + ' = ' + 2 * (w + h) + '.'); };
  B.word3 = t => {
    const chests = ri(3, 9), each = ri(3, 9);
    return inp('word', 'A knight finds ' + chests + ' treasure chests. Each chest holds ' + each + ' coins. How many coins in all?', chests * each, chests + ' chests \u00d7 ' + each + ' coins = ' + chests * each + ' coins.');
  };

  B.mul4 = t => { const a = ri(t === 1 ? 12 : 15, 29), b = ri(4, 9); return mc('multiplication', a + ' \u00d7 ' + b + ' = ?', a * b, [a * b + 10, a * b - 10, a * b + b, a * b - a], a + ' \u00d7 ' + b + ' = ' + a * b); };
  B.div4 = t => { const d = ri(3, 12); const q = ri(4, 12 + t * 3); return mc('division', d * q + ' \u00f7 ' + d + ' = ?', q, [q + 1, q - 1, q + 10], d * q + ' \u00f7 ' + d + ' = ' + q); };
  B.equiv = () => {
    const base = pick([[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [2, 5]]);
    const k = ri(2, 4);
    const ans = (base[0] * k) + '/' + (base[1] * k);
    const wrong = new Set();
    while (wrong.size < 3) {
      const n = ri(1, 9), d = ri(2, 9);
      if (n * base[1] !== d * base[0]) wrong.add(n + '/' + d);
    }
    return { category: 'fractions', mode: 'mc', prompt: 'Which fraction is equivalent to ' + frac(base[0], base[1]) + '?', answer: ans, choices: shuffle([ans].concat(Array.from(wrong))), explain: base[0] + '/' + base[1] + ' = ' + ans + ' (multiply top and bottom by ' + k + ').' };
  };
  B.fracOf4 = t => {
    const n = ri(1, 3), d = pick([2, 3, 4, 5]); const whole = d * ri(2, 5 + t * 2);
    return inp('fractions', n + '/' + d + ' of ' + whole + ' = ?', whole / d * n, whole + ' \u00f7 ' + d + ' = ' + whole / d + ', then \u00d7 ' + n + ' = ' + whole / d * n + '.');
  };
  B.dec4 = t => {
    const a = ri(1, 8) / 10 + ri(0, 3), b = ri(1, 8) / 10;
    const ans = Math.round((a + b) * 10) / 10;
    return mc('decimals', a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ?', ans, [ans + 0.1, ans - 0.1, ans + 1], a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ' + ans.toFixed(1));
  };
  B.word4 = () => {
    const rate = ri(3, 9), hrs = ri(2, 8);
    return inp('word', 'A potion shop sells ' + rate + ' gems per hour. How many gems in ' + hrs + ' hours?', rate * hrs, rate + ' \u00d7 ' + hrs + ' = ' + rate * hrs + ' gems.');
  };

  B.mul5 = t => { const a = ri(100, t === 1 ? 199 : 499), b = ri(11, 29); return mc('multiplication', a + ' \u00d7 ' + b + ' = ?', a * b, [a * b + 100, a * b - 100, a * b + 10], a + ' \u00d7 ' + b + ' = ' + (a * b)); };
  B.div5 = t => { const d = ri(4, 12); const q = ri(12, 24 + t * 6); return inp('division', d * q + ' \u00f7 ' + d + ' = ?', q, d * q + ' \u00f7 ' + d + ' = ' + q); };
  B.fracAdd = () => {
    const d = pick([4, 5, 6, 8]); const a = ri(1, d - 2), b = d - a; // result is a clean integer or <1 sum
    const ans = (a + b) / d;
    if (Number.isInteger(ans)) return inp('fractions', frac(a, d) + ' + ' + frac(b, d) + ' = ?', ans, a + '/' + d + ' + ' + b + '/' + d + ' = ' + (a + b) + '/' + d + ' = ' + ans);
    return mc('fractions', frac(a, d) + ' + ' + frac(b, d) + ' = ?', (a + b) + '/' + d, shuffleFracDistr(a, b, d), frac(a, d) + ' + ' + frac(b, d) + ' = ' + (a + b) + '/' + d);
  };
  function shuffleFracDistr(a, b, d) { const s = new Set(); while (s.size < 3) { const n = ri(1, 2 * d - 1); if (n !== a + b) s.add(n + '/' + d); } return Array.from(s); }
  B.dec5 = t => {
    const a = ri(10, 90) / 10 + ri(0, 8), b = ri(10, 90) / 10;
    const ans = Math.round((a + b) * 10) / 10;
    return mc('decimals', a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ?', ans, [ans + 0.1, ans - 0.1, ans + 1], a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ' + ans.toFixed(1));
  };
  B.pct5 = t => {
    const p = pick([10, 25, 50, 20]); const base = p === 25 ? 4 * ri(5, 15) : p === 50 ? 2 * ri(10, 30) : 10 * ri(4, 12 + t * 3);
    return inp('percent', p + '% of ' + base + ' = ?', base * p / 100, p + '% of ' + base + ' = ' + base * p / 100 + '.');
  };
  B.triArea = () => { const b2 = 2 * ri(3, 9), h = ri(3, 9); return inp('geometry', 'A triangle banner has base ' + b2 + ' and height ' + h + '. Area?', b2 * h / 2, 'Area = base \u00d7 height \u00f7 2 = ' + b2 + ' \u00d7 ' + h + ' \u00f7 2 = ' + b2 * h / 2); };
  B.word5 = () => {
    const start = ri(80, 160), spend = ri(15, 60), find = ri(10, 40);
    return inp('word', 'A hero has ' + start + ' gold. She spends ' + spend + ' and later finds ' + find + '. How many gold now?', start - spend + find, start + ' \u2212 ' + spend + ' = ' + (start - spend) + ', then + ' + find + ' = ' + (start - spend + find) + '.');
  };

  B.fracMul6 = () => { const n = ri(1, 3), d = pick([2, 3, 4, 5]); const whole = d * ri(3, 12); return inp('fractions', n + '/' + d + ' \u00d7 ' + whole + ' = ?', whole / d * n, whole + ' \u00f7 ' + d + ' = ' + whole / d + ', \u00d7 ' + n + ' = ' + whole / d * n + '.'); };
  B.pct6 = () => { const p = pick([15, 20, 30, 35, 40, 60]); const base = 20 * ri(3, 10); return inp('percent', p + '% of ' + base + ' = ?', base * p / 100, '10% of ' + base + ' is ' + base / 10 + ', so ' + p + '% is ' + base * p / 100 + '.'); };
  B.ratio6 = () => {
    const a = ri(2, 6), b = ri(2, 9), k = ri(2, 5);
    return inp('ratio', a + ' : ' + b + '  =  ? : ' + (b * k), a * k, b + ' becomes ' + (b * k) + ' (x ' + k + '), so ' + a + ' x ' + k + ' = ' + (a * k) + '.');
  };
  B.neg6 = () => {
    const a = -ri(1, 9), b = ri(1, 12);
    return mc('negatives', a + ' + ' + b + ' = ?', a + b, [a + b + 1, a + b - 1, Math.abs(a) + b, b - Math.abs(a) + 2], 'Start at ' + a + ', go ' + b + ' right: ' + (a + b) + '.');
  };
  B.order6 = () => {
    const a = ri(2, 9), b = ri(2, 6), c = ri(2, 8);
    const ans = a + b * c;
    return mc('order_ops', a + ' + ' + b + ' \u00d7 ' + c + ' = ?', ans, [(a + b) * c, ans + c, ans - b], 'Multiply first: ' + b + ' \u00d7 ' + c + ' = ' + b * c + ', then + ' + a + ' = ' + ans + '.');
  };
  B.geo6 = () => {
    if (rnd(2)) { const w = ri(4, 12), h = ri(3, 9); return inp('geometry', 'Rectangle: length ' + w + ', width ' + h + '. Area?', w * h, w + ' \u00d7 ' + h + ' = ' + w * h); }
    const s = ri(3, 11); return inp('geometry', 'A square rug has side ' + s + '. What is its perimeter?', 4 * s, '4 sides \u00d7 ' + s + ' = ' + 4 * s);
  };
  B.word6 = () => {
    const total = 10 * ri(8, 15), pct = pick([10, 20, 25]);
    return inp('word', 'A dungeon holds ' + total + ' coins. A trap steals ' + pct + '% of them. How many coins remain?', total - total * pct / 100, pct + '% of ' + total + ' = ' + total * pct / 100 + ', so ' + total + ' \u2212 ' + total * pct / 100 + ' = ' + (total - total * pct / 100) + '.');
  };

  // visual counting wrapper: attach icon art to a counting question
  const _counting = B.counting;
  B.counting = t => { const q = _counting(t); q.visual = { icon: pick(['coin', 'gem', 'potion', 'shield']) }; return q; };

  const POOLS = {
    1: ['counting', 'add1', 'sub1', 'compare', 'missing1', 'sequence1', 'tf1'],
    2: ['add2', 'sub2', 'groups', 'share', 'sequence1', 'placevalue', 'word2', 'missing1'],
    3: ['mul3', 'div3', 'fracOf', 'addBig', 'subBig', 'sequence1', 'areaRect', 'perim', 'word3'],
    4: ['mul4', 'div4', 'equiv', 'fracOf4', 'dec4', 'areaRect', 'perim', 'word4', 'addBig'],
    5: ['mul5', 'div5', 'fracAdd', 'dec5', 'pct5', 'triArea', 'word5'],
    6: ['fracMul6', 'pct6', 'ratio6', 'neg6', 'order6', 'geo6', 'word6']
  };
  MD.CATEGORY_LABELS = { addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication', division: 'Division', fractions: 'Fractions', decimals: 'Decimals', percent: 'Percent', ratio: 'Ratio', negatives: 'Negative Numbers', order_ops: 'Order of Operations', geometry: 'Geometry', sequences: 'Patterns', compare: 'Comparing', counting: 'Counting', word: 'Word Problems', missing: 'Missing Numbers', truefalse: 'True / False', placevalue: 'Place Value' };

  // ---------- validation ----------
  function numEq(a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9; }
  function validate(q) {
    if (!q || typeof q.prompt !== 'string' || !q.prompt.length) return 'missing prompt';
    if (/NaN|undefined|Infinity/.test(q.prompt)) return 'bad token in prompt: ' + q.prompt;
    const okAns = (typeof q.answer === 'number' && Number.isFinite(q.answer)) || (typeof q.answer === 'string' && q.answer.length > 0);
    if (!okAns) return 'bad answer: ' + q.answer;
    if (q.mode === 'mc') {
      if (!Array.isArray(q.choices) || q.choices.length < 2) return 'mc needs >=2 choices';
      const seen = new Set(q.choices.map(String));
      if (seen.size !== q.choices.length) return 'duplicate choices: ' + q.choices.join(',');
      const hits = q.choices.filter(c => numEq(c, q.answer) || c === q.answer).length;
      if (hits !== 1) return 'expected exactly 1 correct, got ' + hits + ' for ' + q.prompt;
    }
    if (q.mode === 'input' && typeof q.answer !== 'number') return 'input answer must be numeric';
    return null;
  }

  // ---------- smart selection ----------
  // weights: base 1; weak categories (>=4 answered, acc<0.7) get x2; recent categories suppressed.
  function makeQuestion(grade, tier, catStats, recentCats) {
    grade = Math.min(6, Math.max(1, grade | 0));
    tier = Math.min(3, Math.max(1, tier | 0));
    const pool = POOLS[grade];
    for (let attempt = 0; attempt < 30; attempt++) {
      const weights = pool.map(b => {
        const cat = B[b](tier).category;
        let w = 1;
        const st = catStats && catStats[cat];
        if (st && st.a >= 4 && st.c / st.a < 0.7) w = 2;
        if (recentCats && recentCats.includes(cat)) w *= 0.35;
        return w;
      });
      let total = weights.reduce((s, w) => s + w, 0), r = Math.random() * total, idx = 0;
      while (r > weights[idx]) { r -= weights[idx]; idx++; }
      const q = B[pool[idx]](tier);
      q.grade = grade; q.tier = tier;
      const err = validate(q);
      if (!err) return q;
    }
    // fallback: simplest safe question
    const q = B.add1(1); q.grade = grade; q.tier = tier; return q;
  }

  // automated dev check: generate thousands, validate all
  function batchTest(n) {
    const errors = []; let count = 0;
    for (let i = 0; i < n; i++) {
      const grade = 1 + (i % 6), tier = 1 + (i % 3);
      const q = makeQuestion(grade, tier, null, []);
      const err = validate(q);
      count++;
      if (err) errors.push('g' + grade + ' t' + tier + ': ' + err);
    }
    return { count, errors };
  }

  MD.MathGen = { makeQuestion, validate, batchTest, POOLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MD.MathGen;
})(typeof window !== 'undefined' ? window : globalThis);
