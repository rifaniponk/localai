// items.js — item bank + procedural generators (DOM-free, works in node & browser)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.IQITEMS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- seeded RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- figure helpers (mirror of svg.js primitives, data only) ----------
  function polySpec(s) {
    const prims = [];
    prims.push({ t: 'poly', n: s.sides, r: 30, fill: s.fill ? 'rgba(38,229,255,.28)' : 'none', rot: s.rot || 0 });
    if (s.dots) prims.push({ t: 'dots', k: s.dots, rad: 14, r: 4 });
    return prims;
  }
  function arrowSpec(rot) { return [{ t: 'arrow', rot: rot, l: 26 }]; }

  // ---------- matrix reasoning (Raven-style) ----------
  let uid = 0;
  function mkMatrix(specFn, b, tier) {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(specFn(r, c));
    const ans = cells[8];
    // distractors: mutate exactly one attribute of the answer
    const cand = [];
    for (const d of [-1, 1]) cand.push(Object.assign({}, ans, { sides: Math.max(3, Math.min(9, ans.sides + d)) }));
    cand.push(Object.assign({}, ans, { fill: !ans.fill }));
    if (ans.dots > 0) { for (const d of [-1, 1]) cand.push(Object.assign({}, ans, { dots: ans.dots + d })); }
    else cand.push(Object.assign({}, ans, { dots: 3 }));
    if (ans.rot) cand.push(Object.assign({}, ans, { rot: (ans.rot + 45) % 360 }));
    const key = s => JSON.stringify([s.sides, s.fill, s.dots, s.rot || 0]);
    const seen = new Set([key(ans)]);
    const opts = [];
    for (const cd of cand) {
      const k = key(cd);
      if (!seen.has(k)) { seen.add(k); opts.push(cd); }
      if (opts.length === 3) break;
    }
    return {
      id: 'mx' + (++uid), cat: 'matrix', tier, b,
      prompt: 'Which figure completes the matrix?',
      figure: { kind: 'matrix', cells: cells.slice(0, 8), answer: ans },
      options: opts.map(o => ({ kind: 'fig', prims: polySpec(o) })),
      answerPrims: polySpec(ans)
    };
  }
  function genMatrix(rnd) {
    return [
      mkMatrix((r, c) => ({ sides: 3 + c, fill: false, dots: 0, rot: 0 }), -1.2, 'easy'),
      mkMatrix((r, c) => ({ sides: 3 + r, fill: false, dots: 0, rot: c * 45 }), -0.9, 'easy'),
      mkMatrix((r, c) => ({ sides: 4, fill: (r + c) % 2 === 0, dots: r + 1, rot: 0 }), -0.4, 'med'),
      mkMatrix((r, c) => ({ sides: 3 + c, fill: r % 2 === 1, dots: c + 1, rot: 0 }), -0.1, 'med'),
      mkMatrix((r, c) => ({ sides: 3 + r + c, fill: c % 2 === 1, dots: r + 1, rot: 0 }), 0.5, 'hard'),
      mkMatrix((r, c) => ({ sides: 4 + ((r + c) % 3), fill: (r * c) % 2 === 0, dots: ((r + c) % 3) + 1, rot: 0 }), 1.0, 'hard')
    ];
  }

  // ---------- number / figure series ----------
  function numSeries(seq, ans, b, tier) {
    const last = seq[seq.length - 1], prev = seq[seq.length - 2];
    const diff = last - prev;
    const cands = [last + diff, 2 * last - prev, last + 2, last - diff, last + diff + 2, last + diff - 1, prev, last + Math.round(diff / 2)];
    const wrong = [];
    for (const c of cands) {
      if (c !== ans && !wrong.includes(c)) wrong.push(c);
      if (wrong.length === 3) break;
    }
    return {
      id: 'se' + (++uid), cat: 'series', tier, b,
      prompt: 'What number comes next?  ' + seq.join(', ') + ', ?',
      figure: null,
      options: [String(ans)].concat(wrong.map(String)).map(v => ({ kind: 'txt', v })),
      answer: 0
    };
  }
  function figSeries(rots, b, tier) {
    const step = rots[1] - rots[0];
    const norm = r => ((r % 360) + 360) % 360;
    const ansRot = norm(rots[rots.length - 1] + step);
    const candRots = [norm(rots[rots.length - 1] - step), norm(rots[rots.length - 1] + step * 2), norm(rots[rots.length - 1] + 90), norm(rots[rots.length - 1] - 90)];
    const wrongRots = candRots.filter(r => r !== ansRot).slice(0, 3);
    return {
      id: 'se' + (++uid), cat: 'series', tier, b,
      prompt: 'The arrow keeps turning by the same step. Which arrow comes next?',
      figure: { kind: 'strip', cells: rots.map(r => arrowSpec(r)) },
      options: [ansRot].concat(wrongRots).map(r => ({ kind: 'fig', prims: arrowSpec(r) })),
      answer: 0
    };
  }
  function genSeries() {
    return [
      numSeries([7, 15, 23, 31], 39, -1.2, 'easy'),
      numSeries([3, 6, 12, 24], 48, -0.9, 'easy'),
      figSeries([0, 45, 90, 135], -0.5, 'med'),
      numSeries([2, 5, 11, 23], 47, -0.2, 'med'),
      numSeries([1, 1, 2, 3, 5], 8, 0.2, 'med'),
      numSeries([4, 6, 9, 13, 18], 23, 0.5, 'hard'),
      numSeries([2, 3, 5, 9, 17], 33, 0.9, 'hard'),
      figSeries([30, 120, 210, 300], 0.7, 'hard')
    ];
  }

  // ---------- spatial: rotation, paper fold & punch, cube nets ----------
  function rotationItem(rot, b, tier) {
    return {
      id: 'sp' + (++uid), cat: 'spatial', tier, b,
      prompt: 'The shape is rotated clockwise by ' + rot + '°. Which result is correct?',
      figure: { kind: 'single', prims: [{ t: 'lshape', rot: 0 }] },
      options: [
        { kind: 'fig', prims: [{ t: 'lshape', rot: rot }] },
        { kind: 'fig', prims: [{ t: 'lshape', rot: 360 - rot }] },
        { kind: 'fig', prims: [{ t: 'lshape', rot: rot, mirror: true }] },
        { kind: 'fig', prims: [{ t: 'lshape', rot: (rot + 90) % 360 }] }
      ],
      answer: 0
    };
  }
  function foldItem(axis, punch, holes, b, tier) {
    // axis: 'v' fold right half onto left; punch = hole shown on folded sheet (x<=50)
    const figPrims = [{ t: 'sheet' }, { t: 'line', x1: 50, y1: 10, x2: 50, y2: 90, stroke: 'var(--line)', sw: 2 },
      { t: 'dot', cx: punch[0], cy: punch[1], r: 5 }];
    const opt = hs => ({ kind: 'fig', prims: [{ t: 'sheet' }].concat(hs.map(h => ({ t: 'dot', cx: h[0], cy: h[1], r: 5 }))) });
    const wrong1 = holes.map(h => [h[0], 100 - h[1]]);
    const wrong2 = holes.map(h => [100 - h[1], h[0]]);
    return {
      id: 'sp' + (++uid), cat: 'spatial', tier, b,
      prompt: 'A square sheet is folded in half (dashed line), then punched. Which is the unfolded sheet?',
      figure: { kind: 'single', prims: figPrims },
      options: [opt(holes), opt(wrong1), opt(wrong2), opt(holes.slice(0, 1))],
      answer: 0
    };
  }
  // fold a polyomino net into a cube: track full orientation frame per cell.
  // Moving to a neighbour in net direction d folds 90deg about the shared edge
  // axis e = (-dy, dx, 0) mapped through the current frame (Rodrigues, cos90=0).
  function netNormals(cells) {
    const idx = new Map(cells.map((c, i) => [c[0] + ',' + c[1], i]));
    const rot90 = (a, v) => { // rotate v +90deg about unit axis a
      const d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
      const cr = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
      return [d * a[0] + cr[0], d * a[1] + cr[1], d * a[2] + cr[2]].map(Math.round);
    };
    const frame = new Array(cells.length).fill(null);
    frame[0] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // images of net x,y,z axes
    const queue = [0];
    const seen = new Set([0]);
    while (queue.length) {
      const i = queue.shift();
      const [x, y] = cells[i];
      const F = frame[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = idx.get((x + dx) + ',' + (y + dy));
        if (j === undefined || seen.has(j)) continue;
        const e = [-dy, dx, 0]; // shared edge direction in net coords
        const a = [e[0] * F[0][0] + e[1] * F[1][0] + e[2] * F[2][0],
                   e[0] * F[0][1] + e[1] * F[1][1] + e[2] * F[2][1],
                   e[0] * F[0][2] + e[1] * F[1][2] + e[2] * F[2][2]];
        frame[j] = F.map(b => rot90(a, b));
        seen.add(j); queue.push(j);
      }
    }
    return frame.map(f => f[2]); // face normal = image of net z axis
  }
  function netItem(cells, markIdx, b, tier) {
    const normals = netNormals(cells);
    const mn = normals[markIdx];
    const oppIdx = normals.findIndex(n => n[0] === -mn[0] && n[1] === -mn[1] && n[2] === -mn[2]);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
    const w = Math.max(...cells.map(c => c[0])) - minX + 1, h = Math.max(...cells.map(c => c[1])) - minY + 1;
    const cw = 100 / (w + 0.6), ch = 100 / (h + 0.6), s = Math.min(cw, ch);
    const ox = 50 - (w * s) / 2, oy = 50 - (h * s) / 2;
    const prims = cells.map((c, i) => {
      const x = ox + (c[0] - minX) * s, y = oy + (c[1] - minY) * s;
      const g = [`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${i === markIdx ? 'rgba(255,210,63,.25)' : 'rgba(38,229,255,.08)'}" stroke="var(--cyan)" stroke-width="2"/>`,
        `<text x="${x + s / 2}" y="${y + s / 2 + 6}" text-anchor="middle" class="svg-txt" style="font-size:${s * 0.42}px">${letters[i]}</text>`];
      if (i === markIdx) g.push(`<circle cx="${x + s - 9}" cy="${y + 9}" r="5" fill="var(--yellow)"/>`);
      return `<g>${g.join('')}</g>`;
    }).join('');
    return {
      id: 'sp' + (++uid), cat: 'spatial', tier, b,
      prompt: 'This net folds into a cube. Which letter ends up on the face OPPOSITE the marked one?',
      figure: { kind: 'raw', svg: `<svg viewBox="0 0 100 100" class="fig">${prims}</svg>` },
      options: letters.map(l => ({ kind: 'txt', v: l })),
      answer: oppIdx
    };
  }
  function genSpatial() {
    return [
      rotationItem(90, -1.2, 'easy'),
      foldItem('v', [30, 35], [[30, 35], [70, 35]], -0.6, 'med'),
      netItem([[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], 1, -0.3, 'med'),
      rotationItem(135, 0.3, 'hard'),
      foldItem('v', [35, 60], [[35, 60], [65, 60]], 0.5, 'hard'),
      netItem([[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]], 0, 0.9, 'hard')
    ];
  }

  // ---------- verbal ----------
  function verbal(prompt, opts, ans, b, tier) {
    return { id: 've' + (++uid), cat: 'verbal', tier, b, prompt, figure: null,
      options: opts.map(o => ({ kind: 'txt', v: o })), answer: ans };
  }
  function genVerbal() {
    return [
      verbal('FINGER is to HAND as TOE is to …', ['FOOT', 'LEG', 'SHOE', 'NAIL'], 0, -1.3, 'easy'),
      verbal('Which one does NOT belong?', ['ROSE', 'TULIP', 'OAK', 'DAISY'], 2, -1.2, 'easy'),
      verbal('BOOK is to READING as FORK is to …', ['EATING', 'COOKING', 'KITCHEN', 'SPOON'], 0, -1.0, 'easy'),
      verbal('Which one does NOT belong?', ['SPARROW', 'EAGLE', 'BAT', 'HERON'], 2, -0.6, 'med'),
      verbal('THERMOMETER is to TEMPERATURE as CLOCK is to …', ['TIME', 'WATCH', 'SPEED', 'DATE'], 0, -0.4, 'med'),
      verbal('CROWN is to KING as ROOF is to …', ['HOUSE', 'RAIN', 'BRICK', 'ATTIC'], 0, -0.2, 'med'),
      verbal('Which one does NOT belong?', ['TRIANGLE', 'CIRCLE', 'CUBE', 'SQUARE'], 2, 0.1, 'med'),
      verbal('PUPPET is to PUPPETEER as CAR is to …', ['DRIVER', 'MECHANIC', 'GARAGE', 'ENGINE'], 0, 0.4, 'hard'),
      verbal('Which one does NOT belong?', ['21', '23', '29', '31'], 0, 0.7, 'hard'),
      verbal('SILENCE is to NOISE as DARKNESS is to …', ['LIGHT', 'COLOR', 'SHADOW', 'NIGHT'], 0, 0.6, 'hard'),
      verbal('LIBRARY is to BOOKS as MARKET is to …', ['GOODS', 'PEOPLE', 'MONEY', 'STREETS'], 0, 0.9, 'hard'),
      verbal('Which one does NOT belong?', ['FEATHER', 'FUR', 'SCALE', 'WOOD'], 3, 1.0, 'hard')
    ];
  }

  // ---------- logic ----------
  function logic(prompt, opts, ans, b, tier) {
    return { id: 'lo' + (++uid), cat: 'logic', tier, b, prompt, figure: null,
      options: opts.map(o => ({ kind: 'txt', v: o })), answer: ans };
  }
  function genLogic() {
    return [
      logic('All BLOOPS are RAZZIES. All RAZZIES are LAZZIES. Are all BLOOPS also LAZZIES?', ['YES', 'NO', 'CANNOT BE DETERMINED'], 0, -1.2, 'easy'),
      logic('Some DOGS bark. Rex is a DOG. Does Rex necessarily bark?', ['YES', 'NO', 'CANNOT BE DETERMINED'], 2, -0.9, 'easy'),
      logic('No FLURPS are GRUMPS. All GRUMPS are TRINKETS. Which MUST be true?', ['Some TRINKETS are not FLURPS', 'All TRINKETS are GRUMPS', 'No TRINKETS are FLURPS', 'All FLURPS are TRINKETS'], 0, -0.3, 'med'),
      logic('If it RAINS, the match is CANCELLED. The match was NOT cancelled. What can we conclude?', ['It did not rain', 'It rained', 'The match was postponed', 'Nothing follows'], 0, -0.1, 'med'),
      logic('Which number does NOT belong with the others: 3, 5, 7, 9, 11?', ['9', '3', '7', '11'], 0, 0.2, 'med'),
      logic('All WIFS are ZIPS. No ZIPS are YAMPS. Which MUST be true?', ['No WIFS are YAMPS', 'Some ZIPS are WIFS', 'All YAMPS are ZIPS', 'Some YAMPS are WIFS'], 0, 0.5, 'hard'),
      logic('Alice says: “Bob lies.” Bob says: “Cara lies.” If Bob truly lies, what is Cara?', ['Telling the truth', 'Lying', 'Cannot be determined'], 0, 0.7, 'hard'),
      logic('The train leaves AFTER the bus. The plane leaves BEFORE the train. The car leaves AFTER the plane. Which order is POSSIBLE?', ['Bus, train, plane, car', 'Plane, bus, train, car', 'Train, bus, car, plane', 'Car, plane, bus, train'], 1, 0.9, 'hard'),
      logic('All roses are flowers. Some flowers fade quickly. Which MUST be true?', ['Some roses fade quickly', 'All flowers are roses', 'Some roses are flowers', 'Roses never fade'], 2, 1.0, 'hard')
    ];
  }

  // ---------- adaptive selection ----------
  const CAPS = { matrix: 4, series: 3, spatial: 3, verbal: 3, logic: 3 };
  function buildPool(rnd) {
    const pool = [].concat(genMatrix(rnd), genSeries(), genSpatial(), genVerbal(), genLogic());
    // shuffle within same (cat,tier) so variants differ per run
    return pool;
  }
  function thetaOf(responses) {
    if (!responses.length) return 0;
    const correct = responses.filter(r => r.ok);
    if (!correct.length) return Math.min(...responses.map(r => r.b)) - 1;
    if (correct.length === responses.length) return Math.max(...responses.map(r => r.b)) + 1;
    return correct.reduce((s, r) => s + r.b, 0) / correct.length;
  }
  function select(seed) {
    const rnd = mulberry32(seed);
    const pool = buildPool(rnd);
    const byCat = {};
    pool.forEach(it => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    const pick = (cat, tier) => byCat[cat].find(i => i.tier === tier);
    const chosen = [];
    const used = new Set();
    // fixed warmup: one easy item per category (covers every test type)
    for (const cat of ['matrix', 'series', 'spatial', 'verbal', 'logic']) {
      const it = pick(cat, 'easy');
      if (it) { chosen.push(it); used.add(it.id); }
    }
    const target = 16;
    let theta = 0;
    while (chosen.length < target) {
      const counts = {};
      chosen.forEach(c => counts[c.cat] = (counts[c.cat] || 0) + 1);
      const avail = pool.filter(i => !used.has(i.id) && (counts[i.cat] || 0) < CAPS[i.cat]);
      // prefer items near current theta; break ties deterministically by seeded order
      avail.sort((a, b) => Math.abs(a.b - theta) - Math.abs(b.b - theta));
      const it = avail[0];
      chosen.push(it); used.add(it.id);
      // pretend a 50/50 respondent to steer difficulty up gradually
      const responses = chosen.map((c, i) => ({ b: c.b, ok: i % 2 === 0 }));
      theta = thetaOf(responses);
    }
    // shuffle option order for text/fig items (answer index recomputed)
    return chosen.map(it => {
      if (it.options && it.answer !== undefined) {
        const order = shuffled(it.options.map((_, i) => i), rnd);
        const opts = order.map(i => it.options[i]);
        return Object.assign({}, it, { options: opts, answer: order.indexOf(it.answer) });
      }
      if (it.options && it.answerPrims) { // matrix: shuffle distractors, append answer at random slot
        const order = shuffled([0, 1, 2, 3], rnd);
        const opts = it.options.slice();
        opts.splice(order[3], 0, { kind: 'fig', prims: it.answerPrims });
        return Object.assign({}, it, { options: opts, answer: order[3] });
      }
      return it;
    });
  }

  return { select, buildPool, mulberry32, thetaOf, CAPS };
});
