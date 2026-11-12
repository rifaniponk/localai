/* ============================================================
   Main — game orchestration: state machine, input, waves,
   answering/blast resolution, boons, nova, game over, loop.
   ============================================================ */
import * as THREE from 'three';
import { World } from './world.js';
import { Hero } from './hero.js';
import { Enemies } from './enemies.js';
import { Vfx } from './vfx.js';
import { UI } from './ui.js';
import Audio from './audio.js';
import Save from './save.js';
import { generateBatch, parseAnswer, tierName, tierSub } from './mathengine.js';

const $ = (sel) => document.querySelector(sel);

const STATE = { TITLE: 0, PLAY: 1, BOON: 2, PAUSE: 3, OVER: 4 };

const BOONS = [
  { ico: '⚔', name: 'Twin Lance', desc: 'Every blast also claims one extra monster.' },
  { ico: '⏳', name: 'Chrono Font', desc: 'Correct answers bend time — 1.4s of slow motion.' },
  { ico: '🛡', name: 'Aegis', desc: '+2 shield pips, instantly reforged.' },
  { ico: '🔥', name: 'Scorch Sigil', desc: 'Kills stagger every nearby monster backwards.' },
  { ico: '⚡', name: 'Swift Sigil', desc: 'Dash 45% faster and 40% further.' },
  { ico: '💰', name: 'Greed Sigil', desc: 'Misses no longer break your combo.' },
];

class Game {
  constructor() {
    this.state = STATE.TITLE;
    this.clearLock = false;
    this.container = document.getElementById('stage');

    this.world = new World(this.container);
    this.vfx = new Vfx(this.world.scene);
    this.hero = new Hero(this.world.scene);
    this.hero.setPips(6, 6);
    this.enemies = new Enemies(this.world.scene, this.vfx, Audio, this);

    /* run state */
    this.wave = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correct = 0;
    this.submits = 0;
    this.typed = '';
    this.novaMeter = 0;
    this.pips = 6;
    this.maxPips = 6;
    this.quests = [];
    this.waveClearT = -1;
    this.slowT = 0;
    this.bonus = { twinLance: 0, chrono: false, scorch: false, swift: 1, greed: false };
    this.tookBoon = new Set();

    /* input */
    this.keys = {};
    this.mouseNdc = new THREE.Vector2();
    this.aimAngle = Math.PI;

    this.clock = new THREE.Clock();
    this._raf = null;
    this._bindInput();
    this._bindButtons();

    Audio.setVolume(Save.volume());
    el.volSlider.value = String(Math.round(Save.volume() * 100));
    el.volSlider.addEventListener('input', () => {
      const v = el.volSlider.value / 100;
      Audio.setVolume(v); Save.setVolume(v);
    });

    UI.showTitle();
    UI.setPips(this.pips, this.maxPips);
    UI.setNova(0, false);

    this._loop();
  }

  /* =================== input =================== */
  _bindInput() {
    window.addEventListener('keydown', (e) => {
      if (this.state === STATE.PLAY) {
        if (/^[0-9]$/.test(e.key)) { this.pushDigit(e.key); e.preventDefault(); return; }
        if (e.key === '-') { this.pushDigit('-'); e.preventDefault(); return; }
        if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); this.refreshConsole(); e.preventDefault(); return; }
        if (e.key === 'Enter') { this.submit(); e.preventDefault(); return; }
        if (e.key === ' ') { this.nova(); e.preventDefault(); return; }
        if (e.key === 'Escape') { this.pause(); return; }
        if (e.key === 'Shift') { this.tryDash(); return; }
      } else if (e.key === 'Escape' && this.state === STATE.PAUSE) {
        this.resume();
        return;
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (this.state === STATE.TITLE) { this.startRun(); return; }
        if (this.state === STATE.OVER) { this.startRun(); return; }
      }
      this.keys[e.key.toLowerCase()] = true;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase()))
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; if (this.state === STATE.PLAY) this.pause(); });

    window.addEventListener('mousemove', (e) => {
      this.mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });

    /* numpad */
    el.numpad.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'enter') this.submit();
        else if (k === 'back') this.typed = this.typed.slice(0, -1);
        else this.pushDigit(k);
        this.refreshConsole();
      });
    });

    el.novaRing.addEventListener('click', () => { if (this.state === STATE.PLAY) this.nova(); });
  }

  _bindButtons() {
    $('#btn-start').addEventListener('click', () => this.startRun());
    $('#btn-how').addEventListener('click', () => UI.show($('#screen-how')));
    $('#btn-back').addEventListener('click', () => UI.showTitle());
    $('#btn-resume').addEventListener('click', () => this.resume());
    $('#btn-quit').addEventListener('click', () => this.abandon());
    $('#btn-again').addEventListener('click', () => this.startRun());
    $('#btn-tut-ok').addEventListener('click', () => {
      $('#screen-tut').classList.add('hidden');
      Save.markTutorial();
    });
  }

  pushDigit(d) {
    if (this.typed.length >= 6) return;
    if (d === '-' && (this.typed.includes('-') || this.typed.length > 0)) return;
    this.typed += d;
    this.refreshConsole();
  }
  refreshConsole() {
    UI.renderConsole(this.typed, this.typed !== '');
  }

  /* =================== answering =================== */
  submit() {
    if (this.state !== STATE.PLAY) return;
    const value = parseAnswer(this.typed);
    this.typed = '';
    this.refreshConsole();
    if (value === null) return;
    this.submits++;

    const matches = this.enemies.matchesFor(value);
    if (matches.length === 0) {
      /* fizzle */
      Audio.fx.fizzle();
      UI.consoleErr();
      UI.toast('NO SOLUTION', 'bad');
      if (!this.bonus.greed) this.combo = 0;
      UI.setCombo(this.combo, false);
      this.vfx.addTrauma(0.12);
      return;
    }

    /* the Arcanum volley */
    this.correct++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    Audio.fx.laser();
    this.hero.fire();
    UI.consoleHit();
    UI.killFlash();
    this.world.fovKickStart();

    const muzzle = new THREE.Vector3();
    this.hero.muzzleWorld(muzzle);

    let launched = 0;
    const fireOne = (enemy, color) => {
      this.vfx.fireProjectile(muzzle.clone(), enemy, (target) => {
        this.resolveKill(target, color);
      }, color);
      launched++;
    };

    for (const m of matches) fireOne(m, 0x06b6d4);

    /* twin lance: extra shots at random other monsters */
    const extras = this.enemies.list.filter(e => e.alive && !matches.includes(e));
    for (let i = 0; i < this.bonus.twinLance && extras.length > 0; i++) {
      const t = extras.splice(Math.floor(Math.random() * extras.length), 1)[0];
      fireOne(t, 0xa085ff);
    }

    if (this.bonus.chrono) this.slowT = Math.max(this.slowT, 1.4);

    UI.toast(`${matches.length} MARKED${launched > matches.length ? ' + TWIN' : ''}`, 'good');
    UI.setCombo(this.combo, launched > matches.length);
  }

  resolveKill(enemy, color) {
    if (!enemy.alive) return;
    const value = enemy.value;
    const died = enemy.takeHit(1);
    if (!died) {
      /* golem / titan shed armor, still alive */
      Audio.fx.impact();
      this.vfx.addTrauma(0.2);
      return;
    }
    this.enemies.kill(enemy, color);
    Audio.fx.impact();
    Audio.fx.chime(this.combo);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = Math.round((value + 1) * 12 * (1 + this.combo * 0.2));
    this.score += pts;
    UI.setScore(this.score);
    UI.setCombo(this.combo, true);
    this.vfx.float(enemy.aimPoint(), String(value), '#7df9ff');
    this.vfx.float(enemy.aimPoint().add(new THREE.Vector3(0.4, 0.6, 0)), `+${pts}`, '#ffc46b');
    this.novaMeter = Math.min(1, this.novaMeter + 0.07);
    UI.setNova(this.novaMeter, this.novaMeter >= 1);

    if (this.bonus.scorch) {
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const d = e.group.position.distanceTo(enemy.group.position);
        if (d < 4) {
          const dir = e.group.position.clone().sub(enemy.group.position).setY(0).normalize();
          e.knock.addScaledVector(dir, 7);
        }
      }
    }
  }

  /* =================== damage / game over =================== */
  onHeroHit(enemy, ranged = false) {
    if (this.state !== STATE.PLAY || this.hero.dead) return;
    void enemy; void ranged;
    this.pips--;
    this.maxPips = Math.max(this.maxPips, 6);
    Audio.fx.hurt();
    UI.hurtFlash();
    UI.pipBreak();
    UI.setPips(this.pips, this.maxPips);
    this.hero.hitFlash();
    this.hero.setPips(this.pips, this.maxPips);
    this.vfx.addTrauma(0.6);
    this.combo = 0;
    UI.setCombo(0);
    if (this.pips <= 0) this.gameOver();
  }

  gameOver() {
    this.state = STATE.OVER;
    this.hero.collapse();
    Audio.stopMusic();
    Audio.fx.gameover();
    this.vfx.slowFactor = 0.3;
    const isBest = Save.setBest(this.score);
    const accuracy = this.submits > 0 ? Math.round((this.correct / this.submits) * 100) : 0;
    setTimeout(() => {
      this.vfx.slowFactor = 1;
      UI.showGameOver({
        score: this.score, waves: this.wave,
        maxCombo: this.maxCombo, accuracy,
      }, isBest);
      Audio.startMusic();
    }, 1500);
  }

  abandon() {
    Audio.fx.click();
    this.enemies.reset();
    this.hero.reset();
    this.state = STATE.TITLE;
    UI.showTitle();
    Audio.suspend();
  }

  /* =================== flow =================== */
  startRun() {
    Audio.ensure();
    Audio.resume();
    Audio.startMusic();
    Audio.fx.click();
    this.enemies.reset();
    this.hero.reset();
    this.hero.setPips(6, 6);
    this.pips = 6; this.maxPips = 6;
    this.wave = 0; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.correct = 0; this.submits = 0;
    this.novaMeter = 0; this.typed = '';
    this.bonus = { twinLance: 0, chrono: false, scorch: false, swift: 1, greed: false };
    this.tookBoon.clear();
    this.slowT = 0;
    UI.setScore(0); UI.setCombo(0); UI.setNova(0, false);
    this.state = STATE.PLAY;
    UI.show(null);
    UI.el.hud.classList.remove('hidden');
    if (matchMedia('(pointer: coarse)').matches) el.numpad.classList.remove('hidden');
    if (!Save.tutorialSeen()) $('#screen-tut').classList.remove('hidden');
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    this.clearLock = false;
    this.quests = [];
    UI.setWave(n, tierName(n));
    UI.banner(`WAVE ${n}`, tierSub(n));
    Audio.fx.horn();
    this.enemies.startWave(n);
    this.world.setRuneLevel(Math.min(4, Math.floor((n - 1) / 4)));
  }

  nextQuest() {
    if (this.quests.length === 0)
      this.quests = generateBatch(this.wave, 8);
    return this.quests.shift();
  }

  waveCleared() {
    /* regen one pip, score bonus */
    if (this.pips < this.maxPips) {
      this.pips++;
      this.hero.setPips(this.pips, this.maxPips);
      UI.setPips(this.pips, this.maxPips);
      UI.toast('SHIELD REFORGED', 'good');
    }
    this.score += 50 + this.wave * 15;
    UI.setScore(this.score);
    if (this.wave % 4 === 0) this.offerBoon();
    else {
      setTimeout(() => {
        if (this.state === STATE.PLAY) this.startWave(this.wave + 1);
      }, 2200);
    }
  }

  offerBoon() {
    this.state = STATE.BOON;
    this.clearLock = true;      /* don't re-arm the wave-clear check while choosing */
    Audio.fx.boon();
    const pool = BOONS.filter(b => !(b.name === 'Aegis' && this.tookBoon.has('Aegis') && this.maxPips >= 10));
    const picks = [];
    while (picks.length < 3 && picks.length < pool.length) {
      const b = pool[Math.floor(Math.random() * pool.length)];
      if (!picks.includes(b)) picks.push(b);
    }
    UI.showBoons(picks, (b) => this.applyBoon(b));
  }

  applyBoon(b) {
    Audio.fx.click();
    this.tookBoon.add(b.name);
    switch (b.name) {
      case 'Twin Lance': this.bonus.twinLance++; break;
      case 'Chrono Font': this.bonus.chrono = true; break;
      case 'Aegis':
        this.maxPips += 2; this.pips += 2;
        this.hero.setPips(this.pips, this.maxPips);
        UI.setPips(this.pips, this.maxPips);
        break;
      case 'Scorch Sigil': this.bonus.scorch = true; break;
      case 'Swift Sigil': this.bonus.swift = 0.55; break;
      case 'Greed Sigil': this.bonus.greed = true; break;
    }
    UI.toast(`${b.name} — ${b.desc}`, 'info');
    this.state = STATE.PLAY;
    UI.show(null);
    setTimeout(() => {
      if (this.state === STATE.PLAY) this.startWave(this.wave + 1);
    }, 1600);
  }

  pause() {
    if (this.state !== STATE.PLAY) return;
    this.state = STATE.PAUSE;
    UI.show(UI.el.screenPause);
    Audio.suspend();
  }
  resume() {
    if (this.state !== STATE.PAUSE) return;
    this.state = STATE.PLAY;
    UI.show(null);
    Audio.resume();
    Audio.fx.click();
  }

  /* =================== abilities =================== */
  tryDash() {
    const k = this.keys;
    let dx = 0, dz = 0;
    if (k.d || k.arrowright) dx += 1;
    if (k.a || k.arrowleft) dx -= 1;
    if (k.s || k.arrowdown) dz += 1;
    if (k.w || k.arrowup) dz -= 1;
    if (this.hero.dash(dx, dz, this.bonus.swift)) {
      Audio.fx.dash();
      this.vfx.spawnRing(this.hero.pos, 0x06b6d4, 2.2, 0.4);
    }
  }

  nova() {
    if (this.novaMeter < 1 || this.state !== STATE.PLAY) return;
    this.novaMeter = 0;
    UI.setNova(0, false);
    UI.novaPulse();
    Audio.fx.nova();
    this.vfx.spawnRing(new THREE.Vector3(this.hero.pos.x, 0.1, this.hero.pos.z), 0xa085ff, 16, 0.9);
    this.vfx.spawnRing(new THREE.Vector3(this.hero.pos.x, 0.1, this.hero.pos.z), 0x06b6d4, 11, 0.7);
    this.vfx.addTrauma(0.5);
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const dir = e.group.position.clone().sub(this.hero.pos).setY(0).normalize();
      e.knock.addScaledVector(dir, 10);
      e.slowT = 3;
      this.vfx.particles.burst(e.aimPoint(), new THREE.Color(0xa085ff), 8, { size: 6, dur: 0.5 });
    }
  }

  /* =================== loop =================== */
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const rawDt = Math.min(0.05, this.clock.getDelta());
    const ts = this.vfx.timeScale();
    const dt = rawDt * ts;

    if (this.slowT > 0) {
      this.slowT -= rawDt;
      this.vfx.slowFactor = 0.45;
    } else if (this.state !== STATE.OVER) {
      this.vfx.slowFactor = 1;
    }

    const playing = this.state === STATE.PLAY;

    /* hero aim: nearest living enemy */
    let aim = this.aimAngle;
    if (playing) {
      let best = null, bestD = Infinity;
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const d = e.group.position.distanceToSquared(this.hero.pos);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        const dx = best.group.position.x - this.hero.pos.x;
        const dz = best.group.position.z - this.hero.pos.z;
        aim = Math.atan2(dx, dz);
      } else {
        aim = Math.atan2(this.mouseNdc.x * 2, 1);
      }
      this.aimAngle += (aim - this.aimAngle) * 0.2;
    }

    /* dash handled on Shift keydown */

    this.hero.update(dt, playing ? this.keys : {}, this.aimAngle, this.vfx, this.vfx.slowFactor);
    if (playing) this.enemies.update(dt, this);

    /* wave clear check */
    if (playing && this.waveClearT < 0 && !this.clearLock &&
        this.enemies.list.length === 0 && this.enemies.queue.length === 0 &&
        this.wave > 0) {
      this.waveClearT = 0.9;
    }
    if (this.waveClearT >= 0) {
      this.waveClearT -= rawDt;
      if (this.waveClearT <= 0) {
        this.waveClearT = -1;
        if (this.enemies.list.length === 0 && this.state === STATE.PLAY) this.waveCleared();
      }
    }

    this.world.update(dt, this.hero.pos);
    /* mouse parallax on camera */
    this.world.camera.position.x += this.mouseNdc.x * 0.4;
    this.world.camera.position.y += this.mouseNdc.y * 0.25;
    this.vfx.update(dt, this.world.camera);
    this.world.render();
  }
}

/* boot */
const el = UI.el;
const game = new Game();
window.__ms3 = game;
