/* ============================================================
   UI — DOM layer: console, HUD chips, shield pips, toasts,
   banners, screens, boon picker, numpad, nova ring.
   ============================================================ */
import Save from './save.js';

const $ = (sel) => document.querySelector(sel);

const el = {
  hud: $('#hud'),
  waveNum: $('#wave-num'),
  waveTier: $('#wave-tier'),
  scoreNum: $('#score-num'),
  comboPill: $('#combo-pill'),
  comboNum: $('#combo-num'),
  shieldRack: $('#shield-rack'),
  banner: $('#banner'),
  bannerTitle: $('#banner-title'),
  bannerSub: $('#banner-sub'),
  toasts: $('#toasts'),
  consoleEl: $('#console'),
  slots: $('#console-slots'),
  novaRing: $('#nova-ring'),
  novaFg: $('#nova-ring .ring-fg'),
  vignette: $('#vignette'),
  flash: $('#flash'),
  numpad: $('#numpad'),
  boonRow: $('#boon-row'),
  screenTitle: $('#screen-title'),
  screenHow: $('#screen-how'),
  screenBoon: $('#screen-boon'),
  screenPause: $('#screen-pause'),
  screenOver: $('#screen-over'),
  screenTut: $('#screen-tut'),
  bestLine: $('#best-line'),
  bestScore: $('#best-score'),
  volSlider: $('#vol-slider'),
};

const CIRC = 2 * Math.PI * 30;

function show(screen) {
  for (const s of [el.screenTitle, el.screenHow, el.screenBoon, el.screenPause, el.screenOver])
    s.classList.add('hidden');
  if (screen) screen.classList.remove('hidden');
}

/* ---------------- console ---------------- */
let lastTyped = '';
function renderConsole(input, armed) {
  const slots = el.slots;
  if (input !== lastTyped) {
    slots.innerHTML = '';
    if (input === '') {
      const s = document.createElement('span');
      s.className = 'slot ghost'; s.textContent = '?';
      slots.appendChild(s);
    } else {
      for (const ch of input) {
        const s = document.createElement('span');
        s.className = 'slot'; s.textContent = ch === '-' ? '−' : ch;
        slots.appendChild(s);
      }
    }
    lastTyped = input;
  }
  el.consoleEl.classList.toggle('armed', armed);
}
function consoleErr() {
  el.consoleEl.classList.remove('err');
  void el.consoleEl.offsetWidth;      // restart animation
  el.consoleEl.classList.add('err');
}
function consoleHit() {
  el.consoleEl.classList.remove('hit');
  void el.consoleEl.offsetWidth;
  el.consoleEl.classList.add('hit');
}

/* ---------------- HUD ---------------- */
function setWave(n, tierName) {
  el.waveNum.textContent = n;
  el.waveTier.textContent = tierName;
}
function setScore(score) {
  el.scoreNum.textContent = score.toLocaleString('en-US');
}
function setCombo(n, blast) {
  if (n >= 2) {
    el.comboPill.classList.remove('hidden');
    el.comboNum.textContent = '×' + n;
    el.comboPill.classList.toggle('blast', !!blast);
  } else {
    el.comboPill.classList.add('hidden');
  }
}
function setPips(pips, max) {
  const pipsEls = el.shieldRack.querySelectorAll('.pip');
  while (pipsEls.length < max) {
    const p = document.createElement('div');
    p.className = 'pip';
    el.shieldRack.appendChild(p);
  }
  const all = el.shieldRack.querySelectorAll('.pip');
  all.forEach((pipEl, i) => {
    pipEl.classList.toggle('dead', i >= pips);
    pipEl.style.display = i < max ? '' : 'none';
  });
}
function pipBreak() {
  const all = el.shieldRack.querySelectorAll('.pip');
  const live = [...all].filter(p => !p.classList.contains('dead'));
  const target = live[live.length - 1];
  if (target) target.classList.add('hit');
}

/* ---------------- toasts + banner ---------------- */
function toast(text, cls = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = text;
  el.toasts.appendChild(t);
  setTimeout(() => t.remove(), 950);
}
function banner(title, sub) {
  el.bannerTitle.textContent = title;
  el.bannerSub.textContent = sub;
  el.banner.classList.remove('hidden');
  el.banner.style.animation = 'none';
  void el.banner.offsetWidth;
  el.banner.style.animation = '';
  setTimeout(() => el.banner.classList.add('hidden'), 2600);
}

/* ---------------- damage fx ---------------- */
let vigT = null;
function hurtFlash() {
  el.vignette.style.opacity = '0.9';
  clearTimeout(vigT);
  vigT = setTimeout(() => { el.vignette.style.opacity = '0'; }, 180);
}
function killFlash() {
  el.flash.style.opacity = '0.2';
  setTimeout(() => { el.flash.style.opacity = '0'; }, 45);
}

/* ---------------- nova ring ---------------- */
function setNova(k, ready) {
  el.novaFg.style.strokeDashoffset = String(CIRC * (1 - k));
  el.novaRing.classList.toggle('ready', !!ready);
}
function novaPulse() {
  el.novaRing.classList.remove('fired');
  void el.novaRing.offsetWidth;
  el.novaRing.classList.add('fired');
}

/* ---------------- boons ---------------- */
function showBoons(boons, onPick) {
  el.boonRow.innerHTML = '';
  boons.forEach((b) => {
    const d = document.createElement('div');
    d.className = 'boon';
    d.innerHTML = `<div class="ico">${b.ico}</div><h3>${b.name}</h3><p>${b.desc}</p>`;
    d.addEventListener('click', () => onPick(b));
    el.boonRow.appendChild(d);
  });
  show(el.screenBoon);
}

/* ---------------- screens / game over ---------------- */
function showGameOver(stats, isBest) {
  $('#ov-score').textContent = stats.score.toLocaleString('en-US');
  $('#ov-waves').textContent = stats.waves;
  $('#ov-combo').textContent = '×' + stats.maxCombo;
  $('#ov-acc').textContent = stats.accuracy + '%';
  $('#ov-newbest').classList.toggle('hidden', !isBest);
  show(el.screenOver);
}
function showTitle() {
  const best = Save.best();
  el.bestLine.classList.toggle('hidden', best <= 0);
  el.bestScore.textContent = best.toLocaleString('en-US');
  show(el.screenTitle);
}

export const UI = {
  el, show, renderConsole, consoleErr, consoleHit,
  setWave, setScore, setCombo, setPips, pipBreak,
  toast, banner, hurtFlash, killFlash, setNova, novaPulse,
  showBoons, showGameOver, showTitle,
};
