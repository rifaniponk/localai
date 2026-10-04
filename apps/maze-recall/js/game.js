/* MAZE RECALL — game engine: memorize 10s → trace from memory → 10 levels. */
(() => {
  'use strict';

  // ---------- level table: [cols, rows] ----------
  const LEVELS = [
    [5, 5], [6, 5], [6, 6], [7, 6], [7, 7],
    [8, 7], [8, 8], [9, 8], [9, 9], [10, 9]
  ];
  const MEMORIZE_MS = 10000;
  const BEST_KEY = 'mazerec…t';

  // ---------- dom ----------
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d');
  const el = {
    menu: $('menu'), hud: $('hud'), over: $('over'), win: $('win'), toast: $('toast'),
    lvl: $('lvl'), lvlfill: $('lvlfill'), phase: $('phase'), phaseIcon: $('phase-icon'),
    phaseText: $('phase-text'), timer: $('timer'),
    ovLvl: $('ov-lvl'), ovBest: $('ov-best'), menuBest: $('menu-best'), bestLvl: $('best-lvl')
  };

  // ---------- state ----------
  let state = 'menu';           // menu | memorize | trace | reveal | clear | win
  let level = 1;
  let best = +(localStorage.getItem(BEST_KEY) || 0);
  let cols = 5, rows = 5, walls = null, solution = [], solSet = null;
  let traced = [];               // cells traced by user (in order)
  let errorCell = -1;
  let phaseT = 0;                // ms elapsed in current phase
  let lastTs = 0;
  let shake = 0;
  let particles = [];
  let stars = [];
  let dpr = 1, W = 0, H = 0;
  let cell = 40, ox = 0, oy = 0;  // geometry
  let dragging = false;
  let lastTickSec = -1;
  let hintPulse = 0;

  // ---------- helpers ----------
  const cx = c => ox + (c % cols + 0.5) * cell;
  const cy = c => oy + (((c / cols) | 0) + 0.5) * cell;
  const cellAt = (x, y) => {
    const gx = Math.floor((x - ox) / cell), gy = Math.floor((y - oy) / cell);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
    return gy * cols + gx;
  };
  const adjacent = (a, b) => {
    const ax = a % cols, ay = (a / cols) | 0, bx = b % cols, by = (b / cols) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  };
  const wallBetween = (a, b) => {
    const ax = a % cols, ay = (a / cols) | 0, bx = b % cols, by = (b / cols) | 0;
    if (bx === ax + 1) return (walls[a] & 2) || (walls[b] & 8);
    if (bx === ax - 1) return (walls[a] & 8) || (walls[b] & 2);
    if (by === ay + 1) return (walls[a] & 4) || (walls[b] & 1);
    return (walls[a] & 1) || (walls[b] & 4);
  };
  const poly = path => path.map(c => [cx(c), cy(c)]);

  function toast(msg, ms = 1300) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.add('hidden'), ms);
  }

  function setPhase(icon, text, showTimer) {
    el.phaseIcon.textContent = icon;
    el.phaseText.textContent = text;
    el.timer.classList.toggle('hidden', !showTimer);
    el.phase.style.animation = 'none';
    void el.phase.offsetWidth;
    el.phase.style.animation = '';
  }

  // ---------- level lifecycle ----------
  function loadLevel() {
    [cols, rows] = LEVELS[level - 1];
    const rng = mulberry32((Date.now() ^ (level * 7919)) >>> 0);
    walls = genMaze(cols, rows, rng);
    solution = solveMaze(cols, rows, walls);
    solSet = new Set(solution);
    traced = [];
    errorCell = -1;
    dragging = false;
    lastTickSec = -1;
    layout();
    el.lvl.textContent = level;
    el.lvlfill.style.width = (level * 10) + '%';
    state = 'memorize';
    phaseT = 0;
    setPhase('👁️', 'MEMORIZE', true);
    el.timer.textContent = '10';
    el.timer.classList.remove('urgent');
  }

  function startRun() {
    SFX.unlock();
    SFX.start();
    level = 1;
    el.menu.classList.add('hidden');
    el.over.classList.add('hidden');
    el.win.classList.add('hidden');
    el.hud.classList.remove('hidden');
    loadLevel();
  }

  function levelClear() {
    state = 'clear';
    phaseT = 0;
    setPhase('✅', 'CLEAR!', false);
    SFX.clear();
    burst(cx(solution[solution.length - 1]), cy(solution[solution.length - 1]), '#ffd94a', 40);
    if (level > best) { best = level; localStorage.setItem(BEST_KEY, best); }
    toast('LEVEL ' + level + ' CLEAR!', 1300);
  }

  function gameOver() {
    if (level > best) { best = level; localStorage.setItem(BEST_KEY, best); }
    el.ovLvl.textContent = level;
    el.ovBest.textContent = Math.max(best, 1);
    el.hud.classList.add('hidden');
    el.over.classList.remove('hidden');
  }

  function showMenu() {
    state = 'menu';
    el.hud.classList.add('hidden');
    el.over.classList.add('hidden');
    el.win.classList.add('hidden');
    el.menu.classList.remove('hidden');
    if (best > 0) { el.menuBest.classList.remove('hidden'); el.bestLvl.textContent = best; }
  }

  // ---------- particles ----------
  function burst(x, y, color, n, spd = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.6 + Math.random() * 1.2, r: 2 + Math.random() * 3.5, color });
    }
  }
  function sparkle(x, y) {
    particles.push({ x, y, vx: (Math.random() - .5) * 40, vy: -30 - Math.random() * 40, life: 1, decay: 1.6, r: 1.5 + Math.random() * 2, color: '#7deaff' });
  }

  // ---------- input ----------
  function ptr(e) {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  cv.addEventListener('pointerdown', e => {
    if (state !== 'trace') return;
    const [x, y] = ptr(e);
    const c = cellAt(x, y);
    const head = traced.length ? traced[traced.length - 1] : -1;
    if (traced.length === 0 && c === solution[0]) {
      traced.push(c);
      dragging = true;
      cv.setPointerCapture(e.pointerId);
      SFX.blip(0); sparkle(cx(c), cy(c));
    } else if (c === head) {
      dragging = true;
      cv.setPointerCapture(e.pointerId);
    } else if (c === 0 && traced.length === 0) {
      // missed the start — nudge the player
      hintPulse = 1;
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!dragging || state !== 'trace') return;
    const [x, y] = ptr(e);
    const c = cellAt(x, y);
    if (c < 0) return;

    // first step must be the start cell
    if (traced.length === 0) {
      if (c === solution[0]) { traced.push(c); SFX.blip(0); sparkle(cx(c), cy(c)); }
      else if (c !== solution[0]) fail(c);
      return;
    }

    const head = traced[traced.length - 1];
    if (c === head) return;

    // backtrack onto the previous traced cell
    if (traced.length >= 2 && c === traced[traced.length - 2]) {
      traced.pop();
      SFX.backtrack();
      return;
    }
    if (!adjacent(head, c)) return;          // jumped cells — ignore, must walk
    if (wallBetween(head, c)) return;        // through a wall — blocked

    const next = solution[traced.length];    // head is solution[traced.length-1] once started
    if (c === next) {
      traced.push(c);
      SFX.blip(traced.length);
      sparkle(cx(c), cy(c));
      if (traced.length === solution.length) levelClear();
    } else {
      fail(c);
    }
  });

  const endDrag = () => { dragging = false; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  function fail(c) {
    state = 'reveal';
    phaseT = 0;
    errorCell = c;
    dragging = false;
    shake = 1;
    SFX.error();
    setPhase('💥', 'WRONG TURN', false);
    burst(cx(c), cy(c), '#ff5d6c', 34, 260);
  }

  // ---------- buttons ----------
  $('btn-start').addEventListener('click', startRun);
  $('btn-retry').addEventListener('click', startRun);
  $('btn-again').addEventListener('click', startRun);
  $('btn-menu').addEventListener('click', showMenu);

  // ---------- layout ----------
  function layout() {
    const padX = Math.min(W, H) * 0.05;
    const top = 74, bottom = 34;
    cell = Math.floor(Math.min((W - padX * 2) / cols, (H - top - bottom) / rows));
    ox = Math.round((W - cols * cell) / 2);
    oy = Math.round(top + (H - top - bottom - rows * cell) / 2);
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    for (let i = 0; i < 70; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.4, Math.random() * 6.28]);
    if (walls) layout();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- drawing ----------
  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1226'); g.addColorStop(0.6, '#0a0f1e'); g.addColorStop(1, '#070a14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, ph] of stars) {
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t / 900 + ph);
      ctx.fillStyle = '#9fd0ff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function strokePolyline(pts, width, color, glow, dash, dashOff) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = width; ctx.strokeStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOff || 0; }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawMaze() {
    const lw = Math.max(2.5, cell * 0.09);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3fd4ff';
    ctx.shadowColor = 'rgba(63,212,255,.75)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let c = 0; c < cols * rows; c++) {
      const x = ox + (c % cols) * cell, y = oy + ((c / cols) | 0) * cell;
      if (walls[c] & 1) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (walls[c] & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      const lastCol = (c % cols) === cols - 1, lastRow = ((c / cols) | 0) === rows - 1;
      if (walls[c] & 2 && lastCol) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (walls[c] & 4 && lastRow) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawStartGoal(t) {
    const s = solution[0], g = solution[solution.length - 1];
    // start pad
    const pr = cell * 0.3 + Math.sin(t / 300) * cell * 0.03 + (hintPulse > 0 && state === 'trace' ? hintPulse * cell * 0.12 : 0);
    ctx.save();
    ctx.shadowColor = '#43d67c'; ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(67,214,124,.9)';
    ctx.beginPath(); ctx.arc(cx(s), cy(s), pr, 0, 7); ctx.fill();
    ctx.fillStyle = '#04220e';
    ctx.font = `900 ${Math.round(cell * 0.3)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶', cx(s), cy(s) + 1);
    ctx.restore();
    // goal flag
    const gx = cx(g), gy = cy(g), fs = cell * 0.62;
    ctx.save();
    ctx.translate(gx, gy + fs * 0.35);
    ctx.shadowColor = '#ffd94a'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = Math.max(2, fs * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -fs); ctx.stroke();
    const wave = Math.sin(t / 240) * fs * 0.06;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(0, -fs);
    ctx.quadraticCurveTo(fs * 0.35, -fs + wave, fs * 0.62, -fs * 0.82 + wave);
    ctx.lineTo(fs * 0.3, -fs * 0.62);
    ctx.quadraticCurveTo(fs * 0.15, -fs * 0.55, 0, -fs * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawSolutionPath(t, opts) {
    const { alpha = 1, color = '#4de3ff', width = null, dash = null, reveal = 1 } = opts;
    const pts = poly(solution);
    if (reveal < 1) {
      // progressive reveal: draw partial polyline
      const total = pts.length - 1;
      const upto = Math.max(1, reveal * total);
      const whole = Math.floor(upto), frac = upto - whole;
      const p = pts.slice(0, whole + 1);
      if (frac > 0 && whole < total) {
        const a = pts[whole], b = pts[whole + 1];
        p.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
      }
      strokePolyline(p, width || cell * 0.34, color, 22, dash, -t / 28);
    } else {
      strokePolyline(pts, width || cell * 0.34, color, 22, dash, -t / 28);
    }
    // flowing energy dots on top
    if (!dash && reveal >= 1) {
      const len = cell * (solution.length - 1);
      const n = Math.max(2, Math.round(len / (cell * 0.9)));
      ctx.save();
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      for (let i = 0; i < n; i++) {
        const d = ((t / 90) + i * len / n) % len;
        let acc = 0, k = 0;
        while (k < solution.length - 1 && acc + cell <= d) { acc += cell; k++; }
        const f = (d - acc) / cell;
        const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
        ctx.beginPath();
        ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, cell * 0.055, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTraced() {
    if (traced.length === 0) return;
    const pts = poly(traced);
    const col = state === 'reveal' ? '#ff5d6c' : '#ffd94a';
    strokePolyline(pts, cell * 0.3, col, 16);
    // head orb
    const h = pts[pts.length - 1];
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(h[0], h[1], cell * 0.16, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawError(t) {
    if (errorCell < 0) return;
    const x = cx(errorCell), y = cy(errorCell), r = cell * 0.3;
    const pop = Math.min(1, phaseT / 250);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.2 + pop * 0.2);
    ctx.scale(pop, pop);
    ctx.shadowColor = '#ff5d6c'; ctx.shadowBlur = 22;
    ctx.strokeStyle = '#ff5d6c'; ctx.lineWidth = cell * 0.12; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r, -r); ctx.lineTo(r, r);
    ctx.moveTo(r, -r); ctx.lineTo(-r, r);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.life -= p.decay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 260 * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- main loop ----------
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    const t = ts;

    if (state === 'memorize') {
      phaseT += dt * 1000;
      const remain = Math.max(0, Math.ceil((MEMORIZE_MS - phaseT) / 1000));
      if (remain !== lastTickSec) {
        lastTickSec = remain;
        el.timer.textContent = remain;
        if (remain <= 3 && remain > 0) { el.timer.classList.add('urgent'); SFX.tick(); }
      }
      if (phaseT >= MEMORIZE_MS) {
        state = 'trace';
        phaseT = 0;
        setPhase('✏️', 'TRACE IT', false);
        SFX.go();
        toast('Drag from ▶ to the flag!', 1500);
      }
    } else if (state === 'reveal') {
      phaseT += dt * 1000;
      if (phaseT > 1900) { state = 'gameoverpanel'; gameOver(); }
    } else if (state === 'clear') {
      phaseT += dt * 1000;
      if (phaseT > 1400) {
        if (level >= LEVELS.length) {
          state = 'win';
          el.hud.classList.add('hidden');
          el.win.classList.remove('hidden');
          SFX.win();
          for (let i = 0; i < 6; i++)
            setTimeout(() => burst(Math.random() * W, Math.random() * H * 0.5, ['#ffd94a', '#4de3ff', '#ff5d6c', '#43d67c'][i % 4], 30, 300), i * 220);
        } else {
          level++;
          loadLevel();
        }
      }
    }

    if (hintPulse > 0) hintPulse = Math.max(0, hintPulse - dt * 2);
    if (shake > 0) shake = Math.max(0, shake - dt * 2.2);

    // ---- render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) ctx.translate((Math.random() - .5) * 14 * shake, (Math.random() - .5) * 14 * shake);
    drawBackground(t);

    if (walls && state !== 'menu') {
      // faint maze floor
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      ctx.fillRect(ox, oy, cols * cell, rows * cell);

      if (state === 'memorize') {
        const reveal = Math.min(1, phaseT / 1100);
        drawSolutionPath(t, { reveal });
      } else if (state === 'reveal' || state === 'gameoverpanel') {
        drawSolutionPath(t, { alpha: 1, color: 'rgba(77,227,255,.5)', width: cell * 0.22, dash: [cell * 0.22, cell * 0.22] });
      }
      drawMaze();
      drawStartGoal(t);
      if (state === 'trace' || state === 'reveal' || state === 'gameoverpanel') drawTraced();
      if (state === 'reveal' || state === 'gameoverpanel') drawError(t);
    }
    drawParticles(dt);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug/test hook (harmless in production)
  window.__MR = { get state() { return state; }, get solution() { return solution; },
    get traced() { return traced; }, get level() { return level; }, get walls() { return walls; },
    geom: () => ({ ox, oy, cell, cols, rows }) };

  if (new URLSearchParams(location.search).get('autostart') === '1') startRun();
  else showMenu();
})();
