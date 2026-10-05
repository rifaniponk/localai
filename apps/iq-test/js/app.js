// app.js — quiz engine, adaptive flow, result screen, starfield
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const TIME_LIMIT = 600; // 10 minutes

  // ---------- starfield ----------
  const cv = $('#stars'), cx = cv.getContext('2d');
  let stars = [];
  function sizeStars() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    for (let i = 0; i < 90; i++) stars.push([Math.random() * innerWidth, Math.random() * innerHeight, Math.random() * 1.6 + 0.4, Math.random() * 6.28]);
  }
  addEventListener('resize', sizeStars); sizeStars();
  (function loop(t) {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const [x, y, r, ph] of stars) {
      cx.globalAlpha = 0.25 + 0.25 * Math.sin(t / 900 + ph);
      cx.fillStyle = ph > 3 ? '#26e5ff' : '#eef2ff';
      cx.fillRect(x, y, r, r);
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })(0);

  // ---------- state ----------
  const state = { items: [], idx: 0, responses: [], t0: 0, timerId: null, locked: false, done: false };

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    document.body.dataset.screen = id; // hides arcade link during quiz & result
  }

  function start() {
    SFX.unlock(); SFX.start();
    state.items = IQITEMS.select((Date.now() % 100000) | 0);
    state.idx = 0; state.responses = []; state.done = false; state.locked = false;
    state.t0 = Date.now();
    clearInterval(state.timerId);
    state.timerId = setInterval(tick, 1000);
    tick();
    show('#scr-quiz');
    renderItem();
  }

  function remaining() { return Math.max(0, TIME_LIMIT - Math.floor((Date.now() - state.t0) / 1000)); }
  function tick() {
    const r = remaining(), m = Math.floor(r / 60), s = r % 60;
    const el = $('#qtimer');
    el.textContent = m + ':' + String(s).padStart(2, '0');
    el.classList.toggle('urgent', r <= 60);
    if (r <= 60 && r > 0 && r % 10 === 0) SFX.urgent();
    if (r === 0) finish();
  }

  const CATLABEL = { matrix: 'MATRIX', series: 'SERIES', spatial: 'SPATIAL', verbal: 'VERBAL', logic: 'LOGIC' };

  function figHTML(spec) {
    if (!spec) return '';
    if (spec.kind === 'raw') return spec.svg;
    if (spec.kind === 'single') return SVG.cell(spec.prims);
    if (spec.kind === 'strip') return '<div class="strip" style="display:flex;gap:8px">' + spec.cells.map(c => SVG.cell(c)).join('') + '</div>';
    if (spec.kind === 'matrix') {
      let h = '<div class="matrix">';
      for (const c of spec.cells) h += SVG.cell(polySpecToPrims(c));
      h += '<div class="fig qcell"><span class="qmark">?</span></div>';
      return h + '</div>';
    }
    return '';
  }
  function polySpecToPrims(s) {
    const prims = [{ t: 'poly', n: s.sides, r: 30, fill: s.fill ? 'rgba(38,229,255,.28)' : 'none', rot: s.rot || 0 }];
    if (s.dots) prims.push({ t: 'dots', k: s.dots, rad: 14, r: 4 });
    return prims;
  }

  function renderItem() {
    const it = state.items[state.idx];
    state.locked = false;
    $('#qidx').textContent = state.idx + 1;
    $('#qbar').style.width = (state.idx / state.items.length * 100) + '%';
    $('#qcat').textContent = CATLABEL[it.cat];
    $('#qprompt').textContent = it.prompt;
    $('#qfigure').innerHTML = figHTML(it.figure);
    const box = $('#qoptions');
    box.innerHTML = '';
    const keys = ['A', 'B', 'C', 'D', 'E', 'F'];
    it.options.forEach((o, i) => {
      const d = document.createElement('div');
      d.className = 'opt';
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      d.innerHTML = '<span class="okey">' + keys[i] + '</span>' +
        (o.kind === 'fig' ? SVG.cell(o.prims) : '<span class="otxt">' + o.v + '</span>');
      d.addEventListener('click', () => answer(i, d));
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i, d); } });
      box.appendChild(d);
    });
    // keyboard shortcuts
  }

  function answer(i, el) {
    if (state.locked || state.done) return;
    state.locked = true;
    const it = state.items[state.idx];
    const ok = i === it.answer;
    state.responses.push({ ok, b: it.b, cat: it.cat });
    el.classList.add('picked', ok ? 'good' : 'bad');
    const fl = $('#qflash');
    fl.className = 'flash ' + (ok ? 'ok' : 'no');
    setTimeout(() => { fl.className = 'flash'; }, 520);
    if (ok) SFX.correct(); else SFX.wrong();
    setTimeout(() => {
      state.idx++;
      if (state.idx >= state.items.length) finish();
      else { SFX.blip(state.idx % 5); renderItem(); }
    }, ok ? 420 : 700);
  }

  // ---------- result ----------
  function finish() {
    clearInterval(state.timerId);
    state.done = true;
    // unanswered items count as wrong (scored honestly)
    const items = state.items.slice(0, Math.max(state.responses.length, state.idx + 1));
    const resp = items.map((_, i) => state.responses[i] ? state.responses[i].ok : false);
    const res = IQSCORE.score(items, resp);
    SFX.finish();
    show('#scr-result');
    // count-up animation
    const el = $('#iqnum');
    let cur = 40; const target = res.iq, t0 = performance.now();
    (function anim(t) {
      const k = Math.min(1, (t - t0) / 1200);
      cur = Math.round(40 + (target - 40) * (1 - Math.pow(1 - k, 3)));
      el.textContent = cur;
      if (k < 1) requestAnimationFrame(anim);
    })(t0);
    const band = $('#iqband');
    band.textContent = res.classify.label;
    band.style.color = res.classify.color;
    $('#iqci').textContent = '95% confidence: ' + res.lo + '–' + res.hi + ' · raw ' + res.raw + '/' + res.total;
    $('#rnote').textContent = res.classify.note + ' Adaptive test, ~10 min. An online estimate is not a clinical diagnosis — real IQ tests (WAIS, Raven) take much longer.';
    // per-category bars
    const names = { matrix: 'FLUID / MATRICES', series: 'PATTERNS', spatial: 'SPATIAL', verbal: 'VERBAL', logic: 'LOGIC' };
    $('#cats').innerHTML = Object.keys(res.perCat).map(c => {
      const v = res.perCat[c];
      const pct = Math.round(v.ok / v.n * 100);
      return '<div class="cat"><span>' + names[c] + '</span><b>' + v.ok + '/' + v.n + '</b><div class="cbar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
    drawBell(res.iq);
    try {
      const best = JSON.parse(localStorage.getItem('iq-test-best') || 'null');
      if (!best || res.iq > best.iq) localStorage.setItem('iq-test-best', JSON.stringify(res));
    } catch (e) { /* private mode */ }
  }

  function drawBell(iq) {
    const c = $('#bell'), g = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 640 * dpr; c.height = 220 * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = 640, H = 220, pad = 26;
    const xOf = v => pad + (v - 55) / (145 - 55) * (W - pad * 2);
    const pdf = v => Math.exp(-((v - 100) ** 2) / (2 * 15 * 15));
    g.clearRect(0, 0, W, H);
    // curve fill
    g.beginPath(); g.moveTo(xOf(55), H - pad);
    for (let v = 55; v <= 145; v += 1) g.lineTo(xOf(v), H - pad - pdf(v) * (H - pad * 2.6));
    g.lineTo(xOf(145), H - pad); g.closePath();
    g.fillStyle = 'rgba(38,229,255,.10)'; g.fill();
    g.strokeStyle = 'rgba(38,229,255,.7)'; g.lineWidth = 2; g.stroke();
    // axis ticks
    g.fillStyle = '#8f86b8'; g.font = '14px VT323, monospace'; g.textAlign = 'center';
    for (const v of [55, 70, 85, 100, 115, 130, 145]) {
      g.fillText(String(v), xOf(v), H - 8);
      g.strokeStyle = 'rgba(43,30,85,.9)'; g.beginPath();
      g.moveTo(xOf(v), H - pad - 3); g.lineTo(xOf(v), H - pad + 3); g.stroke();
    }
    // marker
    const mx = xOf(Math.max(55, Math.min(145, iq)));
    g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.shadowColor = '#ffd23f'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(mx, 12); g.lineTo(mx, H - pad); g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#ffd23f'; g.font = '16px "Press Start 2P", monospace';
    g.fillText(String(iq), mx, 10 + 14);
  }

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (!$('#scr-quiz').classList.contains('active')) return;
    const keys = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
    const i = keys[e.key.toLowerCase()];
    if (i !== undefined) {
      const opts = document.querySelectorAll('#qoptions .opt');
      if (opts[i]) answer(i, opts[i]);
    }
  });

  $('#btn-start').addEventListener('click', start);
  $('#btn-again').addEventListener('click', start);
  $('#btn-menu').addEventListener('click', () => { clearInterval(state.timerId); state.done = true; show('#scr-intro'); });

  // exit-to-menu with confirmation during quiz
  const confirmEl = $('#confirm');
  $('#btn-exit').addEventListener('click', () => { confirmEl.classList.add('open'); });
  $('#btn-confirm-no').addEventListener('click', () => { confirmEl.classList.remove('open'); });
  $('#btn-confirm-yes').addEventListener('click', () => {
    confirmEl.classList.remove('open');
    clearInterval(state.timerId); state.done = true; state.locked = true;
    show('#scr-intro');
  });
  confirmEl.addEventListener('click', e => { if (e.target === confirmEl) confirmEl.classList.remove('open'); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && confirmEl.classList.contains('open')) confirmEl.classList.remove('open'); });

  // debug hook for headless verification
  window.__GAME = {
    get state() { return { idx: state.idx, done: state.done, locked: state.locked, n: state.items.length }; },
    get items() { return state.items; },
    get responses() { return state.responses; },
    start, answer(i) { const opts = document.querySelectorAll('#qoptions .opt'); if (opts[i]) answer(i, opts[i]); },
    score(items, resp) { return IQSCORE.score(items, resp); }
  };
  if (new URLSearchParams(location.search).has('autostart')) start();
})();
