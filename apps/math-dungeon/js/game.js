/* Math Dungeon — core engine: states, player, rooms, camera, battle glue, run stats. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});
  const TS = MD.TS, RW = MD.RW, RH = MD.RH;
  const VIEW_W = 1280, VIEW_H = 720;

  const Game = {
    state: 'menu',           // menu|profile|hero|howto|explore|battle|paused|victory|defeat|upgrade|stats
    save: null,
    dungeonIdx: 0,
    roomIdx: 0,
    room: null,
    rooms: [],
    player: null,
    cam: { x: 0, y: 0, shake: 0 },
    particles: MD.Particles(400),
    floaters: MD.Floaters(),
    input: { up: 0, down: 0, left: 0, right: 0, ix: 0, iy: 0, interact: false },
    isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
    debug: /[?&]debug=true/.test(location.search),
    autostart: /[?&]autostart=1/.test(location.search),
    time: 0, fps: 0,
    run: null,               // per-dungeon-run stats
    battleCtx: null,         // battle arena render info
    canvas: null, ctx: null,
    dpr: 1, scale: 1, offX: 0, offY: 0
  };
  MD.Game = Game;

  // ---------- canvas sizing ----------
  Game.attach = function (canvas) {
    Game.canvas = canvas;
    Game.ctx = canvas.getContext('2d');
    Game.resize();
    window.addEventListener('resize', () => Game.resize());
  };
  Game.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    Game.dpr = Math.min(2, window.devicePixelRatio || 1);
    Game.scale = Math.min(w / VIEW_W, h / VIEW_H);
    const cw = Math.round(VIEW_W * Game.scale), ch = Math.round(VIEW_H * Game.scale);
    Game.canvas.style.width = cw + 'px';
    Game.canvas.style.height = ch + 'px';
    Game.canvas.width = Math.round(cw * Game.dpr);
    Game.canvas.height = Math.round(ch * Game.dpr);
    Game.offX = (w - cw) / 2; Game.offY = (h - ch) / 2;
  };
  Game.canvasToScreen = function (wx, wy) {
    const sx = (wx - Game.cam.x) * Game.scale + Game.offX;
    const sy = (wy - Game.cam.y) * Game.scale + Game.offY;
    return { x: sx, y: sy };
  };

  // ---------- save / profile ----------
  Game.loadSave = function () {
    Game.save = MD.Save.load() || MD.Save.fresh();
    MD.Audio.setSound(Game.save.settings.sound);
    MD.Audio.setMusic(Game.save.settings.music);
  };
  Game.recalcStats = function () {
    const s = Game.save, u = s.upgrades;
    let hp = 0, atk = 0;
    if (u.sword1) atk += 5; if (u.sword2) atk += 10; if (u.sword3) atk += 15;
    if (u.armor1) hp += 10; if (u.armor2) hp += 20;
    s.hpBonus = hp; s.atkBonus = atk;
    if (Game.player) {
      const oldMax = Game.player.maxHp;
      Game.player.maxHp = 50 + hp + (s.level - 1) * 6;
      Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + (Game.player.maxHp - oldMax));
      Game.player.atk = 8 + atk + (s.level - 1) * 2;
      Game.player.speed = 175 * (u.boots1 ? 1.18 : 1);
    }
  };

  // ---------- tutorial ----------
  Game.tut = function (flag, msg) {
    if (Game.save.tutorial[flag]) return;
    Game.save.tutorial[flag] = true;
    MD.Save.save(Game.save);
    MD.UI.toast(msg, 2600);
  };

  // ---------- dungeon run ----------
  Game.startRun = function (dungeonIdx) {
    Game.dungeonIdx = Math.min(MD.DUNGEONS.length - 1, Math.max(0, dungeonIdx));
    Game.save.lastDungeon = Game.dungeonIdx;
    const def = MD.DUNGEONS[Game.dungeonIdx];
    Game.rooms = MD.DungeonGen.roomSequence(def, Game.dungeonIdx);
    Game.roomIdx = 0;
    Game.run = { gold: 0, xp: 0, correct: 0, total: 0, bestCombo: 0, startHp: 0 };
    Game.player = {
      x: 0, y: 0, vx: 0, vy: 0, r: 13, face: 1, state: 'idle', animT: 0, stepT: 0,
      maxHp: 50 + Game.save.hpBonus + (Game.save.level - 1) * 6,
      atk: 8 + Game.save.atkBonus + (Game.save.level - 1) * 2,
      speed: 175 * (Game.save.upgrades.boots1 ? 1.18 : 1)
    };
    Game.player.hp = Game.player.maxHp;
    Game.run.startHp = Game.player.hp;
    Game.enterRoom(0);
    Game.setState('explore');
    MD.UI.hud(true);
    MD.UI.toast(MD.DUNGEONS[Game.dungeonIdx].name + ' \u2014 ' + MD.THEMES[Game.dungeonIdx % MD.THEMES.length].name, 2400);
    Game.tut('move', '\ud83d\udd3a Use WASD / arrows / joystick to move!');
    MD.Audio.startMusic();
    MD.Save.save(Game.save);
  };

  Game.enterRoom = function (idx) {
    Game.roomIdx = idx;
    const def = MD.DUNGEONS[Game.dungeonIdx];
    Game.room = MD.DungeonGen.buildRoom(Game.rooms[idx], def, Game.dungeonIdx, idx, Game.rooms.length);
    Game.player.x = Game.room.spawn.x;
    Game.player.y = Game.room.spawn.y;
    Game.cam.x = clamp(Game.player.x - VIEW_W / 2, 0, RW * TS - VIEW_W);
    Game.cam.y = clamp(Game.player.y - VIEW_H / 2, 0, RH * TS - VIEW_H);
    Game.particles.clear(); Game.floaters.clear();
    if (Game.room.type === 'boss' && !Game.save.tutorial['boss' + Game.dungeonIdx]) {
      Game.save.tutorial['boss' + Game.dungeonIdx] = true;
      MD.Save.save(Game.save);
      const b = Game.room.objects.find(o => o.kind === 'boss');
      MD.UI.toast('\ud83d\udc51 ' + b.enemy.name + ' awaits! Solve to strike!', 3000);
      MD.Audio.play('door');
    }
  };

  // ---------- collision ----------
  function solidAt(wx, wy) {
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return true;
    return Game.room.tiles[ty][tx] === 1;
  }
  function circleHitsWall(x, y, r) {
    // sample 8 points on circle + center
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (solidAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
    }
    return false;
  }

  // ---------- state machine ----------
  Game.setState = function (s) {
    Game.state = s;
    if (s === 'explore') { MD.Battle.end(); MD.UI.hud(true); MD.UI.screen(null); document.getElementById('battlePanel').classList.add('hidden'); }
    if (s === 'battle') { MD.UI.hud(true); }
    if (s === 'paused') MD.UI.screen('scrPause');
    if (s === 'menu') { MD.UI.hud(false); MD.Battle.end(); MD.Audio.stopMusic(); }
  };
  Game.pause = function () {
    if (Game.state === 'explore' || Game.state === 'battle') { Game._prev = Game.state; Game.setState('paused'); MD.Audio.play('button'); }
    else if (Game.state === 'paused') Game.resume();
  };
  Game.resume = function () {
    if (Game.state !== 'paused') return;
    Game.setState(Game._prev || 'explore');
    if (Game._prev === 'battle') document.getElementById('battlePanel').classList.remove('hidden');
    MD.Audio.play('button');
  };

  // ---------- battle glue ----------
  Game.startBattle = function (obj, kind) {
    Game.battleCtx = { obj, t: 0, enemyFlash: 0, playerFlash: 0, enemyDead: false, intro: 1 };
    Game.setState('battle');
    const bc = Game.battleCtx;
    MD.Battle.start(obj.enemy, kind, {
      onCorrect(streak, q) {
        Game.run.total++; Game.run.correct++;
        let mult = streak >= 5 ? 2 : streak >= 3 ? 1.5 : streak >= 2 ? 1.2 : 1;
        let dmg = Math.round(Game.player.atk * mult);
        let power = false;
        if (kind === 'boss' && streak > 0 && streak % 3 === 0) { dmg = Math.round(dmg * 2.5); power = true; }
        if (streak >= 5 && kind !== 'boss') power = true;
        obj.enemy.hp -= dmg;
        bc.enemyFlash = 0.35;
        Game.cam.shake = power ? 1 : 0.5;
        MD.Audio.play(power ? 'power' : (Game.save.hero === 'mage' ? 'magic' : 'sword'));
        const ex = VIEW_W * 0.68, ey = VIEW_H * 0.52;
        Game.floaters.spawn(ex, ey - 90, '-' + dmg, power ? '#ffb45c' : '#fff', power ? 30 : 24);
        Game.particles.spawn(ex, ey - 40, power ? 26 : 12, ['#ffd35c', '#ff8a5c', '#fff'], { speed: power ? 260 : 160 });
        if (power) MD.UI.toast('\u26a1 POWER STRIKE!', 1200);
        if (streak > Game.run.bestCombo) Game.run.bestCombo = streak;
        if (obj.enemy.hp <= 0) {
          bc.enemyDead = true;
          Game.onEnemyDefeated(obj, kind);
        }
      },
      onWrong() {
        Game.run.total++;
        const dmg = obj.enemy.atk;
        Game.player.hp -= dmg;
        bc.playerFlash = 0.35;
        Game.cam.shake = 0.6;
        MD.Audio.play('playerHit');
        Game.floaters.spawn(VIEW_W * 0.3, VIEW_H * 0.55, '-' + dmg, '#ff5f6d', 24);
        Game.particles.spawn(VIEW_W * 0.3, VIEW_H * 0.5, 10, ['#ff5f6d', '#ffb3bb'], { speed: 140 });
        if (Game.player.hp <= 0) Game.defeat();
      }
    });
  };

  Game.onEnemyDefeated = function (obj, kind) {
    const e = obj.enemy;
    const gold = Math.round((8 + e.maxHp * 0.25) * (e.elite ? 2 : 1) * (1 + Game.dungeonIdx * 0.15));
    const xp = Math.round(e.maxHp * 0.6 * (e.elite ? 1.8 : 1));
    Game.run.gold += gold; Game.run.xp += xp;
    Game.save.gold += gold;
    Game.floaters.spawn(VIEW_W * 0.68, VIEW_H * 0.35, '+' + gold + ' \ud83e\ude99', '#ffd35c', 22);
    Game.particles.spawn(VIEW_W * 0.68, VIEW_H * 0.5, 30, [e.color, '#ffd35c', '#fff'], { speed: 240 });
    MD.Audio.play(kind === 'boss' ? 'bossDown' : 'enemyHit');
    MD.Audio.play('coin');
    Game.gainXP(xp);
    if (kind === 'boss') {
      setTimeout(() => Game.victory(), 1200);
    } else {
      obj.dead = true;
      Game.room.cleared = Game.room.objects.every(o => o.kind !== 'enemy' || o.dead);
      setTimeout(() => { if (Game.state === 'battle') Game.setState('explore'); }, 900);
    }
    MD.Save.save(Game.save);
  };

  Game.gainXP = function (xp) {
    const s = Game.save;
    s.xp += xp;
    let need = MD.Save.XP_CURVE(s.level);
    while (s.xp >= need) {
      s.xp -= need;
      s.level++;
      need = MD.Save.XP_CURVE(s.level);
      Game.recalcStats();
      if (Game.player) { Game.player.maxHp = 50 + s.hpBonus + (s.level - 1) * 6; Game.player.hp = Game.player.maxHp; Game.player.atk = 8 + s.atkBonus + (s.level - 1) * 2; }
      MD.Audio.play('levelup');
      MD.UI.toast('\ud83c\udfc3 LEVEL UP! Now level ' + s.level, 2400);
      Game.floaters.spawn(VIEW_W / 2, VIEW_H * 0.3, 'LEVEL UP!', '#7ee2a0', 30);
    }
  };

  // puzzle stone / locked chest: single-question challenge, no HP risk
  Game.startChallenge = function (obj, kind) {
    Game.battleCtx = { obj, t: 0, enemyFlash: 0, playerFlash: 0, enemyDead: false, intro: 1, challenge: true };
    Game.setState('battle');
    const fake = kind === 'chest'
      ? { name: 'Ancient Chest', hp: 1, maxHp: 1, atk: 0, color: '#b8862f', dark: '#8a5a2a', shape: 'chest' }
      : { name: 'Puzzle Stone', hp: 1, maxHp: 1, atk: 0, color: '#4a5068', dark: '#333a4f', shape: 'stone' };
    obj.enemy = fake;
    MD.Battle.start(fake, kind, {
      onCorrect() {
        Game.run.total++; Game.run.correct++;
        const gold = 12 + Game.dungeonIdx * 6 + Math.floor(Math.random() * 10);
        const xp = 20 + Game.dungeonIdx * 8;
        Game.run.gold += gold; Game.run.xp += xp;
        Game.save.gold += gold;
        MD.Audio.play('chest');
        Game.particles.spawn(VIEW_W * 0.68, VIEW_H * 0.45, 34, ['#ffd35c', '#5cd0ff', '#fff'], { speed: 240 });
        Game.floaters.spawn(VIEW_W * 0.68, VIEW_H * 0.3, '+' + gold + ' \ud83e\ude99', '#ffd35c', 24);
        Game.gainXP(xp);
        obj.solved = true; obj.opened = true; obj.dead = true;
        if (kind === 'chest' && Math.random() < 0.35) { Game.save.potions++; MD.UI.toast('Found a healing potion! \ud83e\uddea', 1800); }
        Game.room.cleared = Game.room.objects.every(o => !((o.kind === 'chest' && !o.opened) || (o.kind === 'stone' && !o.solved)));
        MD.Save.save(Game.save);
        setTimeout(() => { if (Game.state === 'battle') Game.setState('explore'); }, 1000);
      },
      onWrong() {
        Game.run.total++;
        // no damage for puzzles — try another question
      }
    });
  };

  // ---------- interaction ----------
  Game.nearestInteractable = function () {
    let best = null, bd = 60;
    for (const o of Game.room.objects) {
      if (o.dead || o.opened || o.solved || o.taken) continue;
      if (o.kind === 'coins') continue; // auto pickup
      const d = Math.hypot(o.x - Game.player.x, o.y - Game.player.y);
      if (d < bd + (o.r || 20)) { bd = d; best = o; }
    }
    // exit door
    const ex = Game.room.exit;
    const de = Math.hypot(ex.x - Game.player.x, ex.y - Game.player.y);
    if (de < 70) {
      if (Game.roomIdx < Game.rooms.length - 1) return { kind: 'door', label: Game.room.cleared ? 'ENTER \u279c' : 'LOCKED \u2014 CLEAR THE ROOM', locked: !Game.room.cleared };
    }
    if (!best) return null;
    switch (best.kind) {
      case 'enemy': return { kind: 'enemy', obj: best, label: 'FIGHT ' + best.enemy.name.toUpperCase() };
      case 'boss': return { kind: 'boss', obj: best, label: 'FIGHT ' + best.enemy.name.toUpperCase() };
      case 'chest': return { kind: 'chest', obj: best, label: best.locked ? 'OPEN ANCIENT CHEST' : 'OPEN CHEST' };
      case 'stone': return { kind: 'stone', obj: best, label: 'READ STONE' };
      case 'fountain': return { kind: 'fountain', obj: best, label: best.used ? 'FOUNTAIN (RESTED)' : 'DRINK \u2663' };
    }
    return null;
  };

  Game.interact = function () {
    const it = Game.nearestInteractable();
    if (!it) return;
    MD.Audio.play('button');
    if (it.kind === 'door') {
      if (it.locked) { MD.UI.toast('Defeat every monster first!', 1600); return; }
      MD.Audio.play('door');
      Game.enterRoom(Game.roomIdx + 1);
      MD.Save.save(Game.save);
      return;
    }
    const o = it.obj;
    if (it.kind === 'enemy') Game.startBattle(o, o.enemy.elite ? 'elite' : 'monster');
    else if (it.kind === 'boss') Game.startBattle(o, 'boss');
    else if (it.kind === 'chest') { if (o.locked) Game.startChallenge(o, 'chest'); else openChest(o); }
    else if (it.kind === 'stone') Game.startChallenge(o, 'stone');
    else if (it.kind === 'fountain') {
      if (o.used) { MD.UI.toast('The fountain is resting.', 1200); return; }
      o.used = true;
      Game.player.hp = Game.player.maxHp;
      MD.Audio.play('heal');
      Game.floaters.spawn(Game.player.x, Game.player.y - 60, 'HP FULL!', '#7ee2a0', 24);
      Game.particles.spawn(Game.player.x, Game.player.y - 30, 20, ['#7ee2a0', '#cfe8ff'], { speed: 120, grav: -40 });
    }
  };
  function openChest(o) {
    o.opened = true;
    const roll = Math.random();
    const gold = 15 + Game.dungeonIdx * 8 + Math.floor(Math.random() * 15);
    Game.run.gold += gold; Game.save.gold += gold;
    MD.Audio.play('chest');
    Game.particles.spawn(o.x, o.y - 20, 26, ['#ffd35c', '#fff'], { speed: 200 });
    Game.floaters.spawn(o.x, o.y - 50, '+' + gold + ' \ud83e\ude99', '#ffd35c', 22);
    if (roll < 0.3) { Game.save.potions++; MD.UI.toast('Treasure: healing potion! \ud83e\uddea', 1800); }
    else if (roll < 0.5) { const xp = 25 + Game.dungeonIdx * 10; Game.run.xp += xp; Game.gainXP(xp); MD.UI.toast('Treasure: ancient knowledge! +' + xp + ' XP', 1800); }
    Game.room.cleared = Game.room.objects.every(ob => !((ob.kind === 'chest' && !ob.opened) || (ob.kind === 'stone' && !ob.solved)));
    Game.tut('interact', '\u2728 Great! Treasure acquired.');
    MD.Save.save(Game.save);
  }

  // ---------- potion ----------
  Game.usePotion = function () {
    if (Game.save.potions <= 0 || !Game.player) return;
    if (Game.state !== 'battle' && Game.state !== 'explore') return;
    if (Game.player.hp >= Game.player.maxHp) { MD.UI.toast('Already at full HP!', 1200); return; }
    Game.save.potions--;
    Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + Math.round(Game.player.maxHp * 0.4));
    MD.Audio.play('heal');
    Game.floaters.spawn(VIEW_W * 0.3, VIEW_H * 0.5, '+HP', '#7ee2a0', 24);
    MD.Save.save(Game.save);
  };

  // ---------- end of run ----------
  Game.victory = function () {
    MD.Battle.end();
    Game.setState('menu'); // stop music-driven states; victory screen is DOM
    const run = Game.run;
    const acc = run.total ? Math.round(run.correct / run.total * 100) : 100;
    let stars = 1;
    if (acc >= 70) stars = 2;
    if (acc >= 90) stars = 3;
    const di = Game.dungeonIdx;
    Game.save.stars[di] = Math.max(Game.save.stars[di] || 0, stars);
    let nextUnlocked = false;
    if (di + 1 < MD.DUNGEONS.length && Game.save.unlockedDungeon < di + 1) {
      Game.save.unlockedDungeon = di + 1;
      nextUnlocked = true;
    }
    // completion bonus
    const bonusGold = 30 + stars * 15, bonusXp = 40 + stars * 20;
    run.gold += bonusGold; run.xp += bonusXp;
    Game.save.gold += bonusGold;
    Game.gainXP(bonusXp);
    MD.Save.save(Game.save);
    MD.Audio.play('levelup');
    MD.UI.showVictory({ stars, acc, correct: run.correct, total: run.total, bestCombo: run.bestCombo, gold: run.gold, xp: run.xp, nextUnlocked });
  };
  Game.defeat = function () {
    MD.Battle.end();
    Game.setState('menu');
    MD.Save.save(Game.save);
    MD.UI.screen('scrDefeat');
  };

  // ---------- update ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  Game.update = function (dt) {
    Game.time += dt;
    Game.particles.update(dt);
    Game.floaters.update(dt);
    Game.cam.shake = Math.max(0, Game.cam.shake - dt * 2.2);
    if (Game.battleCtx) Game.battleCtx.t += dt;
    if (Game.battleCtx) {
      Game.battleCtx.enemyFlash = Math.max(0, Game.battleCtx.enemyFlash - dt);
      Game.battleCtx.playerFlash = Math.max(0, Game.battleCtx.playerFlash - dt);
    }

    if (Game.state === 'explore') {
      const p = Game.player;
      let ix = (Game.input.right - Game.input.left) + Game.input.ix;
      let iy = (Game.input.down - Game.input.up) + Game.input.iy;
      const mag = Math.hypot(ix, iy);
      if (mag > 1) { ix /= mag; iy /= mag; }
      const moving = mag > 0.15;
      if (moving) {
        const nx = p.x + ix * p.speed * dt;
        if (!circleHitsWall(nx, p.y, p.r)) p.x = nx;
        const ny = p.y + iy * p.speed * dt;
        if (!circleHitsWall(p.x, ny, p.r)) p.y = ny;
        p.face = ix >= 0 ? 1 : -1;
        p.state = 'walk';
        p.stepT += dt;
        if (p.stepT > 0.28) { p.stepT = 0; MD.Audio.play('step'); }
        Game.tut('moved', '\ud83d\udc40 Explore every room \u2014 look for chests and doors!');
      } else p.state = 'idle';
      p.animT += dt;
      // auto pickup coins
      for (const o of Game.room.objects) {
        if (o.kind === 'coins' && !o.taken && Math.hypot(o.x - p.x, o.y - p.y) < 34) {
          o.taken = true;
          const g = 5 + Math.floor(Math.random() * 6);
          Game.run.gold += g; Game.save.gold += g;
          MD.Audio.play('coin');
          Game.floaters.spawn(o.x, o.y - 30, '+' + g, '#ffd35c', 18);
          Game.particles.spawn(o.x, o.y, 8, ['#ffd35c'], { speed: 100 });
          MD.Save.save(Game.save);
        }
      }
      // camera follow
      const tx = clamp(p.x - VIEW_W / 2, 0, RW * TS - VIEW_W);
      const ty = clamp(p.y - VIEW_H / 2, 0, RH * TS - VIEW_H);
      Game.cam.x += (tx - Game.cam.x) * Math.min(1, dt * 6);
      Game.cam.y += (ty - Game.cam.y) * Math.min(1, dt * 6);
      // interact hint
      const it = Game.nearestInteractable();
      if (it) {
        const pos = it.obj || Game.room.exit;
        MD.UI.interactHint(pos.x, pos.y - (pos.r || 20) - 26, it.label);
      } else MD.UI.interactHint(0, 0, null);
      if (Game.input.interact) { Game.input.interact = false; Game.interact(); }
    } else {
      MD.UI.interactHint(0, 0, null);
      if (Game.state === 'battle' && Game.battleCtx) {
        // idle anims only
      }
    }
    if (Game.state === 'explore' || Game.state === 'battle') MD.UI.updateHUD(Game.player, Game.save, Game.roomIdx, Game.rooms.length);
  };

  // ---------- render ----------
  Game.render = function () {
    const ctx = Game.ctx;
    const dpr = Game.dpr, sc = Game.scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, Game.canvas.width / dpr, Game.canvas.height / dpr);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, Game.offX * dpr, Game.offY * dpr);

    const inGame = Game.state === 'explore' || Game.state === 'battle' || Game.state === 'paused';
    if (!inGame) {
      renderMenuBackdrop(ctx);
      return;
    }
    const sh = Game.cam.shake;
    const shx = (Math.random() - 0.5) * 14 * sh, shy = (Math.random() - 0.5) * 14 * sh;
    ctx.save();
    ctx.translate(-Game.cam.x + shx, -Game.cam.y + shy);
    if (Game.state === 'battle') renderBattle(ctx);
    else renderExplore(ctx);
    Game.particles.draw(ctx);
    Game.floaters.draw(ctx);
    ctx.restore();
    // torch vignette
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  };

  function renderExplore(ctx) {
    const room = Game.room;
    const theme = MD.THEMES[Game.dungeonIdx % MD.THEMES.length];
    const t = Game.time;
    // floor
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      if (room.tiles[y][x] === 0) {
        ctx.fillStyle = (x + y) % 2 ? theme.floor : theme.floorAlt;
        ctx.fillRect(x * TS, y * TS, TS, TS);
        if ((x * 7 + y * 13) % 11 === 0) { ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(x * TS + 6, y * TS + 6, TS - 12, TS - 12); }
      }
    }
    // walls
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      if (room.tiles[y][x] === 1) {
        ctx.fillStyle = theme.wall;
        ctx.fillRect(x * TS, y * TS, TS, TS);
        ctx.fillStyle = theme.wallTop;
        ctx.fillRect(x * TS, y * TS, TS, 10);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1);
      }
    }
    // exit door
    const ex = room.exit;
    const open = room.cleared;
    ctx.fillStyle = open ? '#3a2c1c' : '#241a10';
    ctx.fillRect(ex.x - TS / 2, ex.y - TS, TS, TS * 2);
    ctx.fillStyle = open ? theme.accent : '#555';
    ctx.beginPath(); ctx.arc(ex.x + TS * 0.25, ex.y, 4, 0, Math.PI * 2); ctx.fill();
    if (open) {
      const g = 0.35 + Math.sin(t * 4) * 0.15;
      ctx.fillStyle = 'rgba(255,211,92,' + g + ')';
      ctx.fillRect(ex.x - TS / 2 + 4, ex.y - TS + 4, TS - 8, TS * 2 - 8);
    }
    // decorations
    for (const d of room.decorations) {
      if (d.k === 'torch') {
        ctx.fillStyle = '#5a4326';
        ctx.fillRect(d.x - 3, d.y - 4, 6, 14);
        const fl = 0.7 + Math.sin(t * 9 + d.x) * 0.3;
        ctx.fillStyle = theme.torch;
        ctx.beginPath(); ctx.ellipse(d.x, d.y - 8, 5 * fl, 8 * fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.ellipse(d.x, d.y - 9, 2 * fl, 3.5 * fl, 0, 0, Math.PI * 2); ctx.fill();
      } else if (d.k === 'barrel') { ctx.fillStyle = '#5a4326'; ctx.beginPath(); ctx.roundRect(d.x - 9, d.y - 14, 18, 20, 4); ctx.fill(); ctx.strokeStyle = '#3a2c1c'; ctx.strokeRect(d.x - 9, d.y - 8, 18, 3); }
      else if (d.k === 'ore') { ctx.fillStyle = '#4a4a55'; ctx.beginPath(); ctx.arc(d.x, d.y - 4, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(d.x - 3, d.y - 6, 2.5, 0, Math.PI * 2); ctx.arc(d.x + 4, d.y - 3, 2, 0, Math.PI * 2); ctx.fill(); }
      else if (d.k === 'statue') { ctx.fillStyle = '#6d654e'; ctx.fillRect(d.x - 7, d.y - 26, 14, 26); ctx.beginPath(); ctx.arc(d.x, d.y - 30, 6, 0, Math.PI * 2); ctx.fill(); }
      else if (d.k === 'crystal') { ctx.fillStyle = 'rgba(159,232,255,.8)'; ctx.beginPath(); ctx.moveTo(d.x, d.y - 24); ctx.lineTo(d.x + 7, d.y); ctx.lineTo(d.x - 7, d.y); ctx.closePath(); ctx.fill(); }
      else if (d.k === 'book') { ctx.fillStyle = '#8a5a8a'; ctx.fillRect(d.x - 8, d.y - 12, 16, 12); ctx.fillStyle = '#c79fff'; ctx.fillRect(d.x - 8, d.y - 12, 16, 3); }
      else if (d.k === 'skull') { ctx.fillStyle = '#d8d8c8'; ctx.beginPath(); ctx.arc(d.x, d.y - 8, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(d.x - 2.5, d.y - 9, 1.5, 0, Math.PI * 2); ctx.arc(d.x + 2.5, d.y - 9, 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // ambient particles
    const pt = theme.particle;
    if (Math.random() < 0.12) {
      const px = Game.cam.x + Math.random() * VIEW_W, py = Game.cam.y + Math.random() * VIEW_H;
      const col = pt === 'snow' ? 'rgba(220,240,255,.7)' : pt === 'ember' ? 'rgba(255,140,60,.6)' : pt === 'spark' ? 'rgba(199,159,255,.6)' : 'rgba(255,255,255,.25)';
      Game.particles.spawn(px, py, 1, [col], { speed: 12, decay: 0.5, grav: pt === 'snow' ? 18 : pt === 'ember' ? -30 : 8, r: 2 });
    }
    // objects
    for (const o of room.objects) {
      if (o.dead) continue;
      if (o.kind === 'chest') MD.drawChest(ctx, o, t);
      else if (o.kind === 'fountain') MD.drawFountain(ctx, o, t);
      else if (o.kind === 'stone') MD.drawStone(ctx, o, t);
      else if (o.kind === 'coins') { if (!o.taken) MD.drawCoins(ctx, o, t); }
      else if (o.kind === 'enemy' || o.kind === 'boss') {
        MD.drawEnemy(ctx, o.enemy, o.x, o.y, t + o.x * 0.01, o.kind === 'boss' ? 1.25 : 0.9, 0);
        // hp bar above
        const w = 44, hpr = Math.max(0, o.enemy.hp / o.enemy.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(o.x - w / 2, o.y - (o.kind === 'boss' ? 96 : 74), w, 6);
        ctx.fillStyle = '#ff5f6d'; ctx.fillRect(o.x - w / 2, o.y - (o.kind === 'boss' ? 96 : 74), w * hpr, 6);
      }
    }
    // player
    const p = Game.player;
    MD.drawHero(ctx, Game.save.hero, p.x, p.y, p.state, p.animT, p.face, 1);
  }

  function renderBattle(ctx) {
    const bc = Game.battleCtx;
    const theme = MD.THEMES[Game.dungeonIdx % MD.THEMES.length];
    // arena backdrop
    ctx.fillStyle = theme.floor;
    ctx.fillRect(Game.cam.x, Game.cam.y, VIEW_W, VIEW_H);
    ctx.fillStyle = theme.floorAlt;
    for (let i = 0; i < 24; i++) ctx.fillRect(Game.cam.x + i * 60, Game.cam.y + 480 + (i % 3) * 40, 40, 20);
    ctx.fillStyle = theme.wall;
    ctx.fillRect(Game.cam.x, Game.cam.y, VIEW_W, 120);
    for (let x = 0; x < VIEW_W; x += 160) {
      const fl = 0.7 + Math.sin(Game.time * 9 + x) * 0.3;
      ctx.fillStyle = theme.torch;
      ctx.beginPath(); ctx.ellipse(Game.cam.x + x + 80, Game.cam.y + 100, 6 * fl, 10 * fl, 0, 0, Math.PI * 2); ctx.fill();
    }
    const px = VIEW_W * 0.3, py = VIEW_H * 0.62;
    const ex = VIEW_W * 0.68, ey = VIEW_H * 0.62;
    const e = bc.obj.enemy;
    const isBoss = e.maxHp >= 100;
    // hero
    const attacking = bc.enemyFlash > 0;
    MD.drawHero(ctx, Game.save.hero, px, py, attacking ? 'attack' : (bc.playerFlash > 0 ? 'hurt' : 'idle'), bc.t, 1, 1.6);
    if (bc.playerFlash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + bc.playerFlash + ')'; ctx.fillRect(px - 40, py - 110, 80, 115); }
    // enemy
    if (!bc.enemyDead) {
      const sc = isBoss ? 2.1 : 1.7;
      const shape = e.shape;
      if (shape === 'chest') MD.drawChest(ctx, { x: ex, y: ey, opened: false, big: true }, Game.time);
      else if (shape === 'stone') MD.drawStone(ctx, { x: ex, y: ey, solved: false }, Game.time);
      else MD.drawEnemy(ctx, e, ex, ey, Game.time, sc, bc.enemyFlash > 0);
    }
    // nameplates + HP bars
    battleBar(ctx, px, py - 130, 'YOU', Game.player.hp, Game.player.maxHp, '#ff5f6d', 200);
    if (!bc.enemyDead) battleBar(ctx, ex, ey - (isBoss ? 190 : 130), e.name, Math.max(0, e.hp), e.maxHp, e.elite ? '#ffb45c' : '#7ee2a0', 220);
  }
  function battleBar(ctx, x, y, label, hp, max, color, w) {
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(label, x + 1, y - 7);
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 8);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x - w / 2, y, w, 12);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, hp / max), 12);
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.strokeRect(x - w / 2 + 0.5, y + 0.5, w - 1, 11);
    ctx.font = '11px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.max(0, Math.ceil(hp)) + ' / ' + max, x, y + 26);
  }

  function renderMenuBackdrop(ctx) {
    // dungeon-y animated backdrop for menu screens
    const t = Game.time;
    ctx.fillStyle = '#0b0f1c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // stone wall band
    ctx.fillStyle = '#141a2b';
    ctx.fillRect(0, 0, VIEW_W, 260);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) {
      ctx.strokeStyle = 'rgba(255,255,255,.04)';
      ctx.strokeRect(x * 80 + (y % 2) * 40, y * 52, 80, 52);
    }
    // floor
    ctx.fillStyle = '#101627';
    ctx.fillRect(0, 260, VIEW_W, VIEW_H - 260);
    // torches
    for (const tx of [180, 520, 760, 1100]) {
      const fl = 0.7 + Math.sin(t * 8 + tx) * 0.3;
      ctx.fillStyle = '#5a4326'; ctx.fillRect(tx - 4, 200, 8, 26);
      ctx.fillStyle = '#ffb45c';
      ctx.beginPath(); ctx.ellipse(tx, 190, 8 * fl, 14 * fl, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(tx, 200, 10, tx, 200, 220);
      g.addColorStop(0, 'rgba(255,180,92,.10)'); g.addColorStop(1, 'rgba(255,180,92,0)');
      ctx.fillStyle = g; ctx.fillRect(tx - 220, 0, 440, 440);
    }
    // glowing treasure
    const gl = 0.4 + Math.sin(t * 2.2) * 0.2;
    ctx.save(); ctx.translate(1050, 560);
    ctx.fillStyle = 'rgba(255,211,92,' + gl * 0.25 + ')';
    ctx.beginPath(); ctx.arc(0, -14, 60, 0, Math.PI * 2); ctx.fill();
    MD.drawChest(ctx, { x: 0, y: 0, opened: false, big: true }, t);
    ctx.restore();
    MD.drawCoins(ctx, { x: 220, y: 580 }, t);
    // hero silhouette idle
    MD.drawHero(ctx, Game.save && Game.save.hero ? Game.save.hero : 'knight', 300, 600, 'idle', t, 1, 1.5);
    // dust motes
    for (let i = 0; i < 26; i++) {
      const x = (i * 173 + t * (8 + i % 5)) % VIEW_W;
      const y = (i * 97 + Math.sin(t * 0.6 + i) * 30 + t * 4) % VIEW_H;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.05 * Math.sin(t + i)) + ')';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- debug shortcuts ----------
  Game.debugCmd = function (k) {
    if (!Game.debug) return;
    if (k === 'h' && Game.player) { Game.player.hp = Game.player.maxHp; MD.UI.toast('debug: healed'); }
    if (k === 'g' && Game.save) { Game.save.gold += 100; MD.Save.save(Game.save); MD.UI.toast('debug: +100 gold'); }
    if (k === 'j' && Game.state === 'explore' && Game.roomIdx < Game.rooms.length - 1) { Game.room.cleared = true; Game.enterRoom(Game.roomIdx + 1); MD.UI.toast('debug: skip room'); }
    if (k === 'b' && Game.state === 'explore') { Game.room.cleared = true; Game.roomIdx = Game.rooms.length - 2; Game.enterRoom(Game.rooms.length - 1); }
    if (k === 'v' && Game.state === 'explore') { Game.victory(); }
  };

  // ---------- E2E hook ----------
  window.__GAME = {
    get state() { return Game.state; },
    get roomIdx() { return Game.roomIdx; },
    get rooms() { return Game.rooms.length; },
    get dungeonIdx() { return Game.dungeonIdx; },
    get player() { return Game.player && { x: Game.player.x, y: Game.player.y, hp: Game.player.hp, maxHp: Game.player.maxHp }; },
    get enemy() { return Game.battleCtx && Game.battleCtx.obj && Game.battleCtx.obj.enemy; },
    get question() { return MD.Battle.active && MD.Battle.active.question; },
    get tier() { return Game.save && MD.Battle.currentTier(Game.save, Game.dungeonIdx); },
    get grade() { return Game.save && Game.save.grade; },
    answer(i) { MD.Battle.key(String(i + 1)); },
    answerInput(v) { MD.Battle._testAnswer(v); },
    correctAnswer() { const q = MD.Battle.active && MD.Battle.active.question; return q ? q.answer : null; },
    startRun(i) { Game.startRun(i || 0); },
    move(dx, dy) { Game.input.ix = dx; Game.input.iy = dy; },
    interact() { Game.interact(); },
    skip() { Game.debugCmd('j'); }
  };
})(window);
