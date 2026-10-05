/* Math Dungeon — bootstrap: game loop, input, screen wiring. */
(function () {
  'use strict';
  const G = window.MD.Game;
  const el = id => document.getElementById(id);

  // ---------- boot ----------
  G.loadSave();
  G.attach(el('game'));
  MD.Battle.init();
  MD.UI.buildProfile();
  MD.UI.buildHero();
  MD.UI.screen('scrMenu');
  el('btnContinue').disabled = !MD.Save.hasSave() || !G.save.grade;

  // ---------- loop ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big pauses (tab switch)
    if (G.state !== 'paused') G.update(dt);
    G.render();
    fpsAcc += dt; fpsN++;
    if (G.debug && fpsAcc >= 0.5) {
      G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
      const d = el('debug');
      d.classList.remove('hidden');
      d.textContent = 'FPS ' + G.fps + ' | state ' + G.state +
        '\nroom ' + (G.roomIdx + 1) + '/' + G.rooms.length + ' dungeon ' + G.dungeonIdx +
        '\nplayer ' + (G.player ? Math.round(G.player.x) + ',' + Math.round(G.player.y) + ' hp ' + Math.round(G.player.hp) : '-') +
        '\ngrade ' + G.save.grade + ' tier ' + (MD.Battle.active ? 'q:' + MD.Battle.active.question.category + ' t' + MD.Battle.active.question.tier : '-') +
        '\n[h]eal [g]old [j]ump [b]oss [v]ictory';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- keyboard ----------
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    const act = KEYMAP[e.code];
    if (act) { G.input[act] = 1; e.preventDefault(); return; }
    if (e.code === 'KeyE' || e.code === 'Space') {
      if (G.state === 'explore') { G.interact(); e.preventDefault(); }
      return;
    }
    if (e.code === 'Escape') {
      if (G.state === 'paused') G.resume();
      else if (G.state === 'explore' || G.state === 'battle') G.pause();
      else if (G.state === 'menu' && !el('scrHowto').classList.contains('hidden')) showMenu();
      return;
    }
    if (G.state === 'battle') {
      if (MD.Battle.key(e.key)) { e.preventDefault(); return; }
      if (e.key === 'p' || e.key === 'P') G.usePotion();
      return;
    }
    if (G.debug) G.debugCmd(e.key.toLowerCase());
  });
  window.addEventListener('keyup', e => {
    const act = KEYMAP[e.code];
    if (act) G.input[act] = 0;
  });

  // ---------- virtual joystick ----------
  (function joystick() {
    const stick = el('stick'), knob = el('knob');
    let id = null, cx = 0, cy = 0, R = 55;
    stick.addEventListener('pointerdown', e => {
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2 - 12;
      move(e); stick.setPointerCapture(id);
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    function move(e) {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      G.input.ix = dx / R; G.input.iy = dy / R;
    }
    function end(e) {
      if (e.pointerId !== id) return;
      id = null; G.input.ix = 0; G.input.iy = 0;
      knob.style.transform = 'translate(-50%,-50%)';
    }
  })();
  el('btnInteract').addEventListener('click', () => { if (G.state === 'explore') G.interact(); });
  el('btnPotion').addEventListener('click', () => G.usePotion());

  // ---------- screens wiring ----------
  function audioUnlock() { MD.Audio.unlock(); MD.Audio.play('button'); }
  function showMenu() {
    G.setState('menu');
    MD.UI.screen('scrMenu');
    el('btnContinue').disabled = !MD.Save.hasSave() || !G.save.grade;
  }
  function startNew() {
    audioUnlock();
    MD.Audio.play('start');
    if (!G.save.grade) { MD.UI.selectedGrade = null; MD.UI.selectedAge = null; el('btnGradeNext').disabled = true; MD.UI.buildProfile(); MD.UI.screen('scrProfile'); G.state = 'profile'; }
    else if (!G.save.hero) { MD.UI.selectedHero = null; el('btnHeroNext').disabled = true; MD.UI.buildHero(); MD.UI.screen('scrHero'); G.state = 'hero'; }
    else G.startRun(Math.min(G.save.unlockedDungeon, MD.DUNGEONS.length - 1));
  }

  el('btnPlay').addEventListener('click', startNew);
  el('btnContinue').addEventListener('click', () => {
    audioUnlock();
    MD.Audio.play('start');
    G.startRun(Math.min(G.save.lastDungeon || 0, G.save.unlockedDungeon));
  });
  el('btnHowto').addEventListener('click', () => { audioUnlock(); MD.UI.screen('scrHowto'); });
  el('btnHowtoBack').addEventListener('click', () => { audioUnlock(); showMenu(); });
  el('btnStatsMenu').addEventListener('click', () => { audioUnlock(); MD.UI.renderStats(); MD.UI.screen('scrStats'); });

  el('btnGradeNext').addEventListener('click', () => {
    audioUnlock();
    G.save.grade = MD.UI.selectedGrade;
    G.save.age = MD.UI.selectedAge;
    MD.Save.save(G.save);
    MD.UI.selectedHero = null;
    el('btnHeroNext').disabled = true;
    MD.UI.buildHero();
    MD.UI.screen('scrHero');
  });
  el('btnHeroNext').addEventListener('click', () => {
    audioUnlock();
    G.save.hero = MD.UI.selectedHero;
    MD.Save.save(G.save);
    G.startRun(0);
  });

  // pause menu
  el('btnPause').addEventListener('click', () => G.pause());
  el('btnResume').addEventListener('click', () => G.resume());
  el('btnPauseHowto').addEventListener('click', () => { MD.Audio.play('button'); MD.UI.screen('scrHowto'); });
  el('btnRestartDun').addEventListener('click', () => { audioUnlock(); G.startRun(G.dungeonIdx); });
  el('btnQuitMenu').addEventListener('click', () => { audioUnlock(); MD.Save.save(G.save); showMenu(); });
  el('tglSound').addEventListener('click', () => {
    G.save.settings.sound = !G.save.settings.sound;
    MD.Audio.setSound(G.save.settings.sound);
    MD.Save.save(G.save); MD.UI.syncToggles(); MD.Audio.play('button');
  });
  el('tglMusic').addEventListener('click', () => {
    G.save.settings.music = !G.save.settings.music;
    MD.Audio.setMusic(G.save.settings.music);
    MD.Save.save(G.save); MD.UI.syncToggles(); MD.Audio.play('button');
  });
  MD.UI.syncToggles();

  // victory / defeat / shop / stats
  el('btnNextDun').addEventListener('click', () => { audioUnlock(); G.startRun(Math.min(G.save.unlockedDungeon, MD.DUNGEONS.length - 1)); });
  el('btnReplay').addEventListener('click', () => { audioUnlock(); G.startRun(G.dungeonIdx); });
  el('btnUpgrades').addEventListener('click', () => { audioUnlock(); MD.UI.renderShop(); MD.UI.screen('scrUpgrade'); });
  el('btnVicMenu').addEventListener('click', () => { audioUnlock(); showMenu(); });
  el('btnRetry').addEventListener('click', () => { audioUnlock(); G.startRun(G.dungeonIdx); });
  el('btnDefeatMenu').addEventListener('click', () => { audioUnlock(); showMenu(); });
  el('btnShopBack').addEventListener('click', () => {
    audioUnlock();
    // return to victory screen if run stats exist, else menu
    if (G.run && G.state === 'menu') MD.UI.showVictory(window.__lastVictory || { stars: G.save.stars[G.dungeonIdx] || 0, acc: 0, correct: 0, total: 0, bestCombo: G.save.stats.bestCombo, gold: 0, xp: 0, nextUnlocked: G.save.unlockedDungeon > G.dungeonIdx });
    else showMenu();
  });
  el('btnStatsBack').addEventListener('click', () => { audioUnlock(); showMenu(); });
  el('btnReset').addEventListener('click', () => {
    MD.Audio.play('button');
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      MD.Save.clear();
      G.loadSave();
      MD.UI.syncToggles();
      MD.UI.toast('Progress reset. A fresh adventure awaits!');
      showMenu();
    }
  });

  // remember last victory payload for shop-back
  const _showVictory = MD.UI.showVictory.bind(MD.UI);
  MD.UI.showVictory = res => { window.__lastVictory = res; _showVictory(res); };

  // autostart for headless verification
  if (G.autostart) {
    G.save.grade = parseInt(new URLSearchParams(location.search).get('grade') || '3', 10);
    G.save.hero = new URLSearchParams(location.search).get('hero') || 'knight';
    setTimeout(() => G.startRun(parseInt(new URLSearchParams(location.search).get('dungeon') || '0', 10)), 100);
  }

  // prevent accidental selection/scroll during gameplay
  document.getElementById('stage').addEventListener('contextmenu', e => e.preventDefault());
})();
