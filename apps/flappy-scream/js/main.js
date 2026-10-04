/* ============================================================
   main.js — wiring UI + loop
   ============================================================ */
'use strict';

Assets.build();

const canvas = document.getElementById('game');
const sfx = new Sfx();
const voice = new VoiceInput();
const game = new Game(canvas, sfx);

const $ = id => document.getElementById(id);
const menu = $('menu'), hud = $('hud'), over = $('over'), cd = $('countdown'),
      cdnum = $('cdnum'), toast = $('toast'), volfill = $('volfill'),
      scoreEl = $('score');

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

game.onState = (st, val) => {
  hide(menu); hide(over); hide(cd); hide(hud);
  if (st === 'menu') show(menu);
  if (st === 'countdown') { show(cd); show(hud); }
  if (st === 'playing') show(hud);
  if (st === 'dead') {
    $('final-score').textContent = game.meters() + ' m';
    $('best-score').textContent = game.best + ' m';
    $('newbest').classList.toggle('hidden', !game.newBest);
    show(over);
  }
  if (st === 'milestone') {
    toast.textContent = '🎉 ' + val + ' m!';
    show(toast);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => hide(toast), 1200);
  }
};

async function startGame() {
  sfx.ensure();
  if (!voice.ready) {
    try {
      await voice.start();
    } catch (e) {
      toast.textContent = '⚠️ Mic unavailable — game runs, but voice controls are off. Allow mic access & reload.';
      show(toast);
      setTimeout(() => hide(toast), 4000);
    }
  }
  game.startCountdown();
}

$('btn-start').addEventListener('click', startGame);
$('btn-retry').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', () => game.toMenu());

window.addEventListener('resize', () => game.resize());
game.resize();
game.toMenu();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const level = voice.ready ? voice.level() : 0;
  game.update(dt, level);
  game.render();
  // HUD
  if (game.state === 'playing' || game.state === 'countdown') {
    scoreEl.textContent = game.meters() + ' m';
    volfill.style.height = Math.round(level * 100) + '%';
    volfill.style.filter = level > 0.55 ? 'drop-shadow(0 0 6px #ff4d4d)' : 'none';
  }
  // angka countdown
  if (game.state === 'countdown') {
    const n = Math.ceil(game.cdT);
    if (cdnum.textContent !== String(n)) {
      cdnum.textContent = n;
      cdnum.style.animation = 'none'; void cdnum.offsetWidth; cdnum.style.animation = '';
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
