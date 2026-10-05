/* Math Survivor — Three.js engine: battlefield, entities, combat, endless difficulty.
 * The player's ONLY input is numeric answers; hero auto-aims and auto-fires.
 */
import * as THREE from "./vendor/three.module.js";
import { AF } from "./assets.js";
import { Audio } from "./audio.js";

const MG = (typeof window !== "undefined" && window.MGQ) || null;

// ---- world constants ----
const LANES = [-4.8, -2.4, 0, 2.4, 4.8];
const SPAWN_Z = -9.2;
const HERO_Z = 5.2;
const HIT_Z = 4.2;          // enemy reaches hero
const MAX_ANSWERS = 999;

const ENEMY_TYPES = {
  slime:    { build: () => AF.slime(0x59c96a),    speed: 0.55, score: 100, minTier: 1 },
  bat:      { build: () => AF.bat(0x7a5cc9),      speed: 1.05, score: 125, minTier: 2 },
  skeleton: { build: () => AF.skeleton(0x7ee0ff), speed: 0.75, score: 150, minTier: 3 },
  ghost:    { build: () => AF.ghost(0x9fd8ef),    speed: 0.8,  score: 150, minTier: 4 },
  golem:    { build: () => AF.golem(0x8d8d99),    speed: 0.38, score: 200, minTier: 4 }
};

const STAGES = [
  { name: "Ancient Ruins", fog: 0x101426, floor: "#2a2f45", floorLine: "#3d4463", key: 0x8fa8ff, amb: 0x30364f, accent: 0x5a7bff },
  { name: "Dark Cavern",   fog: 0x0b0f1e, floor: "#23283c", floorLine: "#333c5c", key: 0x6f7fff, amb: 0x232a44, accent: 0x9a5cff },
  { name: "Lava Depths",   fog: 0x1c0f12, floor: "#3a2430", floorLine: "#5c3345", key: 0xff9a5c, amb: 0x442a2a, accent: 0xff5a2a },
  { name: "Frozen Depths", fog: 0x0e1622, floor: "#26344a", floorLine: "#3a5578", key: 0x7ad8ff, amb: 0x27405c, accent: 0x2fb8ff },
  { name: "Arcane Realm",  fog: 0x140f24, floor: "#31264a", floorLine: "#4a3a72", key: 0xc9a2ff, amb: 0x3a2f5c, accent: 0xff5ce0 }
];

export class Engine {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.labelsEl = opts.labels;
    this.onHud = opts.onHud;         // (hud) => void
    this.onFeedback = opts.onFeedback; // "correct" | "wrong"
    this.onGameOver = opts.onGameOver; // (stats) => void
    this.onStage = opts.onStage;     // (stageName) => void
    this.debug = /[?&]debug=true/.test(location.search);

    this.running = false;
    this.paused = false;
    this._initScene();
    this._initParticles();
    this._resetRun();

    this._last = performance.now();
    this._raf = requestAnimationFrame(() => this._loop());

    document.addEventListener("visibilitychange", () => {
      this.paused = document.hidden;
    });
    window.addEventListener("resize", () => this._resize());
    this._resize();
  }

  // ---------------- scene ----------------
  _initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x101426, 22, 52);
    this.camera = new THREE.PerspectiveCamera(55, 0.56, 0.1, 60);
    this.camBase = new THREE.Vector3(0, 8.4, 15.4);
    this.camLook = new THREE.Vector3(0, 0.6, -0.5);

    this.amb = new THREE.AmbientLight(0x30364f, 2.4);
    this.key = new THREE.DirectionalLight(0x8fa8ff, 3.0);
    this.key.position.set(3, 10, 6);
    this.rim = new THREE.PointLight(0x5a7bff, 1.6, 26);
    this.rim.position.set(0, 4, -10);
    this.scene.add(this.amb, this.key, this.rim);

    this.floorMat = new THREE.MeshStandardMaterial({ map: AF.floorTex("#2a2f45", "#3d4463"), roughness: 0.95 });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 24), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.z = -1;
    this.scene.add(this.floor);

    // rune circle around hero
    this.rune = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: AF.runeTex("#6f8cff"), transparent: true, opacity: 0.5, depthWrite: false }));
    this.rune.rotation.x = -Math.PI / 2;
    this.rune.position.set(0, 0.03, HERO_Z);
    this.scene.add(this.rune);

    // side pillars + torches for depth
    this.torchLights = [];
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -8 + i * 4.5;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a4f66, roughness: 0.9 }));
      p.position.set(side * 6.4, 1.7, z);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb05c, emissive: 0xff7a2a, emissiveIntensity: 1.8 }));
      flame.position.set(side * 6.4, 3.6, z);
      const tl = new THREE.PointLight(0xff8a3c, 0.9, 8);
      tl.position.copy(flame.position);
      this.scene.add(p, flame, tl);
      this.torchLights.push({ flame, light: tl, phase: i * 1.7 });
    }

    // floating dust motes
    const dustGeo = new THREE.BufferGeometry();
    const dn = 60, dp = new Float32Array(dn * 3);
    this.dustSeed = [];
    for (let i = 0; i < dn; i++) { dp[i * 3] = (Math.random() - 0.5) * 12; dp[i * 3 + 1] = Math.random() * 6; dp[i * 3 + 2] = -10 + Math.random() * 18; this.dustSeed.push(Math.random() * 6.28); }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: AF.glowTex("rgba(180,200,255,0.9)", "rgba(120,150,255,0.3)"), size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dust);

    const hero = AF.hero();
    this.hero = hero.group;
    this.heroParts = hero.parts;
    this.hero.position.set(0, 0, HERO_Z);
    this.scene.add(this.hero);
    this.heroAura = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xffb02a, emissiveIntensity: 1.4, transparent: true, opacity: 0 }));
    this.heroAura.rotation.x = Math.PI / 2;
    this.heroAura.position.set(0, 0.2, HERO_Z);
    this.scene.add(this.heroAura);

    this.shieldDome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), new THREE.MeshStandardMaterial({ color: 0x8aff9e, emissive: 0x3adf5e, emissiveIntensity: 0.7, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shieldDome.position.set(0, 1.0, HERO_Z);
    this.shieldDome.visible = false;
    this.scene.add(this.shieldDome);

    this.shake = 0;
  }

  _initParticles() {
    this.PMAX = 420;
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.PMAX * 3);
    this.pCol = new Float32Array(this.PMAX * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3));
    this.pGeo = geo;
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ map: AF.glowTex("rgba(255,255,255,0.95)", "rgba(255,255,255,0.35)"), size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.pList = []; // {x,y,z,vx,vy,vz,life,decay,r,g,b}
    for (let i = 0; i < this.PMAX; i++) this.pPos[i * 3 + 1] = -999;
  }

  burst(x, y, z, color, n, power) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.pList.length < this.PMAX; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI;
      const s = (0.6 + Math.random()) * (power || 3);
      this.pList.push({
        x, y, z,
        vx: Math.sin(e) * Math.cos(a) * s, vy: Math.abs(Math.cos(e)) * s * 1.2, vz: Math.sin(e) * Math.sin(a) * s,
        life: 1, decay: 1.4 + Math.random(), r: c.r, g: c.g, b: c.b
      });
    }
  }

  // ---------------- run state ----------------
  _clearEntities() {
    for (const t of [...(this.targets || [])]) {
      this._unregister(t);
      this._dispose(t.group); this.scene.remove(t.group);
    }
    for (const t of [...(this.dyingList || [])]) {
      this._dispose(t.group); this.scene.remove(t.group);
      if (t.el) t.el.remove();
    }
    for (const p of this.projs || []) this.scene.remove(p.mesh);
    for (const w of this.waves || []) { this.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); }
    for (const z of this.zaps || []) { this.scene.remove(z.mesh); z.mesh.geometry.dispose(); z.mesh.material.dispose(); }
    this.targets = [];
    this.dyingList = [];
    this.answerMap = new Map();
    this.projs = [];
    this.waves = [];
    this.zaps = [];
    this.pList.length = 0;
    this.boss = null;
  }

  _resetRun() {
    this._clearEntities();

    this.grade = 2;
    this.hp = 3; this.maxHp = 3;
    this.score = 0; this.combo = 0; this.bestCombo = 0;
    this.kills = 0; this.correct = 0; this.attempts = 0;
    this.time = 0;
    this.spawnTimer = 1.2;
    this.powerTimer = 22;
    this.bossTimer = 105;
    this.breather = 0;
    this.freezeT = 0; this.slowT = 0;
    this.shield = false;
    this.heroAnim = { attack: 0, hurt: 0, dead: 0 };
    this.perf = { recent: [], pressure: 1 }; // adaptive difficulty
    this.stageIdx = 0;
    this._applyStage(0, true);
    this._pushHud();
  }

  start(grade) {
    this._resetRun();
    this.grade = grade;
    this.running = true;
    this.paused = false;
    this.gameOver = false;
    Audio.cues.start();
    // opening enemies
    for (let i = 0; i < 2; i++) this._spawnEnemy();
    this._pushHud();
  }

  exitRun() {
    this.running = false;
    this.gameOver = false;
    this.heroAnim.dead = 0;
    this.hero.rotation.x = 0;
    this._clearEntities();
  }

  // ---------------- difficulty ----------------
  _tier() {
    // curriculum tier 1..5 from survival time, grade caps it
    const t = 1 + Math.floor(this.time / 55);
    return Math.max(1, Math.min(5, t));
  }
  _pressure() {
    // adaptive: recent accuracy nudges spawn pressure (never changes curriculum)
    const r = this.perf.recent;
    if (r.length < 5) return this.perf.pressure;
    const acc = r.reduce((a, b) => a + b, 0) / r.length;
    const target = acc > 0.85 ? 1.25 : acc < 0.5 ? 0.75 : 1;
    this.perf.pressure += (target - this.perf.pressure) * 0.15;
    return this.perf.pressure;
  }
  _maxEnemies() {
    if (this.boss) return 3;
    if (this.time < 30) return 3;
    if (this.time < 60) return 4;
    if (this.time < 120) return 5;
    if (this.time < 240) return 6;
    return Math.min(8, 6 + Math.floor((this.time - 240) / 120));
  }
  _spawnInterval() {
    const base = Math.max(1.6, 4.6 - this.time * 0.012);
    return base / this._pressure();
  }
  _speedMul() {
    return (1 + Math.min(0.9, this.time * 0.004)) * this._pressure();
  }

  // ---------------- targets (unique-answer registry) ----------------
  _makeQuestion() {
    const tier = this._tier();
    for (let i = 0; i < 30; i++) {
      const q = MG.make(this.grade, tier);
      if (q && Number.isInteger(q.answer) && Math.abs(q.answer) <= MAX_ANSWERS && !this.answerMap.has(q.answer)) return q;
    }
    return null; // registry saturated; skip this spawn
  }

  _register(target) {
    this.targets.push(target);
    this.answerMap.set(target.answer, target);
    // DOM formula label
    const el = document.createElement("div");
    el.className = "flabel" + (target.kind === "powerup" ? " plabel" : "");
    el.textContent = target.q.display;
    this.labelsEl.appendChild(el);
    target.el = el;
  }

  _unregister(target) {
    const i = this.targets.indexOf(target);
    if (i >= 0) this.targets.splice(i, 1);
    if (this.answerMap.get(target.answer) === target) this.answerMap.delete(target.answer);
    if (target.el) target.el.remove();
  }

  _removeTarget(target, instant) {
    this._unregister(target);
    if (target.dying) return;
    target.dying = true;
    const g = target.group;
    if (instant) { this._dispose(g); this.scene.remove(g); return; }
    target.deathT = 0; // squash animation handled in loop (dyingList)
    this.dyingList.push(target);
  }

  _dispose(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material._shared) o.material.dispose();
    });
  }

  _freeLane() {
    const used = new Set(this.targets.map(t => t.lane));
    const free = LANES.map((_, i) => i).filter(i => !used.has(i));
    if (!free.length) return Math.floor(Math.random() * LANES.length);
    return free[Math.floor(Math.random() * free.length)];
  }

  _spawnEnemy(forceType) {
    if (this.targets.filter(t => t.kind === "enemy").length >= this._maxEnemies()) return;
    const q = this._makeQuestion();
    if (!q) return;
    const tier = this._tier();
    const pool = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].minTier <= tier);
    const type = forceType || pool[Math.floor(Math.random() * pool.length)];
    const built = ENEMY_TYPES[type].build();
    const lane = this._freeLane();
    built.group.position.set(LANES[lane] + (Math.random() - 0.5) * 0.7, 0, SPAWN_Z - Math.random() * 1.5);
    built.group.rotation.y = Math.PI; // face hero
    this.scene.add(built.group);
    const elite = tier >= 4 && Math.random() < 0.18;
    const t = {
      kind: "enemy", type, group: built.group, parts: built.parts,
      q, answer: q.answer, lane, targeted: false, dying: false, deathT: 0,
      speed: ENEMY_TYPES[type].speed * (elite ? 1.15 : 1),
      score: elite ? 200 : ENEMY_TYPES[type].score,
      elite, bob: Math.random() * 6.28, fadeT: type === "ghost" ? Math.random() * 6.28 : 0
    };
    if (elite) {
      t.group.scale.setScalar(1.22);
      t.group.traverse(o => { if (o.material && o.material.emissive) { o.material.emissive.setHex(0xff3c6e); o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity || 0, 0.5); } });
    }
    this._register(t);
  }

  _spawnPowerup(forceType) {
    if (this.targets.some(t => t.kind === "powerup")) return;
    const q = this._makeQuestion();
    if (!q) return;
    const types = ["freeze", "bomb", "shield", "slow", "lightning"];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    const built = AF.powerup(type);
    const lane = this._freeLane();
    built.group.position.set(LANES[lane] + (Math.random() - 0.5) * 0.6, 0, SPAWN_Z + 1 + Math.random() * 3);
    this.scene.add(built.group);
    const t = { kind: "powerup", type, group: built.group, parts: built.parts, q, answer: q.answer, lane, targeted: false, dying: false, deathT: 0, speed: 0.42, ttl: 18, bob: Math.random() * 6.28 };
    this._register(t);
  }

  _spawnBoss() {
    if (this.boss) return;
    const q = this._makeQuestion();
    if (!q) { this.bossTimer = 8; return; }
    const built = AF.bossDragon();
    built.group.position.set(0, 0, SPAWN_Z - 1);
    built.group.rotation.y = Math.PI;
    this.scene.add(built.group);
    const t = {
      kind: "boss", type: "dragon", group: built.group, parts: built.parts,
      q, answer: q.answer, lane: 2, targeted: false, dying: false, deathT: 0,
      speed: 0.22, hp: 5, maxHp: 5, bob: 0
    };
    this._register(t);
    this.boss = t;
    this.bossHpEl = null;
    Audio.cues.bossIn();
    this.shake = 1;
    this._pushHud();
  }

  _bossNewFormula(boss) {
    this.answerMap.delete(boss.answer);
    const q = this._makeQuestion() || MG.make(this.grade, this._tier());
    boss.q = q; boss.answer = q.answer;
    if (boss.el) boss.el.textContent = q.display;
    this.answerMap.set(q.answer, boss);
  }

  // ---------------- combat ----------------
  submit(n) {
    if (!this.running || this.gameOver) return { ok: false };
    this.attempts++;
    const t = this.answerMap.get(n);
    if (!t || t.targeted || t.dying) {
      this.combo = 0;
      this.perf.recent.push(0);
      if (this.perf.recent.length > 10) this.perf.recent.shift();
      Audio.cues.wrong();
      this.onFeedback && this.onFeedback("wrong");
      this._pushHud();
      return { ok: false };
    }
    this.answerMap.delete(n);
    t.targeted = true;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.correct++;
    this.perf.recent.push(1);
    if (this.perf.recent.length > 10) this.perf.recent.shift();
    this._fire(t);
    Audio.cues.correct();
    if (this.combo === 10 || this.combo === 20 || this.combo === 30) Audio.cues.combo(this.combo);
    this.heroAnim.attack = 1;
    this.onFeedback && this.onFeedback("correct");
    this._pushHud();
    return { ok: true, target: t.kind };
  }

  _fire(target) {
    const tier = this.combo >= 30 ? 3 : this.combo >= 20 ? 2 : this.combo >= 10 ? 1 : 0;
    const colors = [0x7ef0ff, 0x7effc0, 0xffd35c, 0xff7ae0];
    const col = colors[tier];
    const size = 0.14 + tier * 0.05;
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(size * 2.1, 10, 8), new THREE.MeshBasicMaterial({ map: AF.glowTex("rgba(255,255,255,0.8)", "rgba(140,200,255,0.35)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.add(core, halo);
    mesh.position.set(0, 1.7, HERO_Z - 0.3);
    this.scene.add(mesh);
    this.projs.push({ mesh, target, speed: 16 + tier * 3, trailT: 0 });
    Audio.cues.shoot();
    this.shake = Math.max(this.shake, 0.25 + tier * 0.1);
  }

  _updateProjectiles(dt) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      const t = p.target;
      if (t.dying) { // target already gone (bomb/lightning) — fizzle
        this.burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0x9fb8ff, 6, 2);
        this.scene.remove(p.mesh); this.projs.splice(i, 1);
        continue;
      }
      const tp = new THREE.Vector3(t.group.position.x, 1.1, t.group.position.z);
      const dir = tp.clone().sub(p.mesh.position);
      const dist = dir.length();
      if (dist < 0.55) {
        this._hitTarget(t);
        this.scene.remove(p.mesh); this.projs.splice(i, 1);
        continue;
      }
      dir.normalize();
      p.mesh.position.addScaledVector(dir, p.speed * dt);
      p.trailT += dt;
      if (p.trailT > 0.03) {
        p.trailT = 0;
        this.burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0x7ec8ff, 1, 0.6);
      }
    }
  }

  _hitTarget(t) {
    if (t.kind === "powerup") {
      this._activatePowerup(t);
      this._removeTarget(t);
      this.score += 50 * this._comboMul();
      this._floatScore(t, "+PWR");
      return;
    }
    if (t.kind === "boss") {
      t.hp--;
      Audio.cues.impact();
      this.burst(t.group.position.x, 1.6, t.group.position.z, 0xff5ce0, 26, 4);
      this.shake = Math.max(this.shake, 0.5);
      this.score += 150 * this._comboMul();
      this._floatScore(t, "+" + Math.round(150 * this._comboMul()));
      if (t.hp <= 0) {
        this._killBoss(t);
      } else {
        this._bossNewFormula(t);
      }
      this._pushHud();
      return;
    }
    // normal enemy
    const pts = Math.round(t.score * this._comboMul());
    this.score += pts;
    this.kills++;
    Audio.cues.impact();
    Audio.cues.defeated();
    const c = t.elite ? 0xff3c6e : 0x9fe8ff;
    this.burst(t.group.position.x, 1.0, t.group.position.z, c, 26, 3.6);
    this._floatScore(t, "+" + pts);
    this._removeTarget(t);
    this._pushHud();
  }

  _killBoss(t) {
    const pts = Math.round(1500 * this._comboMul());
    this.score += pts;
    this.kills++;
    this.boss = null;
    this.breather = 8;
    this.burst(t.group.position.x, 1.6, t.group.position.z, 0xffd35c, 90, 6);
    this.burst(t.group.position.x, 1.6, t.group.position.z, 0xff5ce0, 60, 5);
    this.shake = 1.2;
    Audio.cues.highScore();
    this._floatScore(t, "BOSS +" + pts);
    this._removeTarget(t);
    this._pushHud();
  }

  _comboMul() {
    if (this.combo >= 20) return 2;
    if (this.combo >= 10) return 1.5;
    if (this.combo >= 5) return 1.25;
    return 1;
  }

  _activatePowerup(t) {
    Audio.cues.powerup();
    const hx = 0, hz = HERO_Z;
    switch (t.type) {
      case "freeze":
        this.freezeT = 4.5;
        Audio.cues.freeze();
        this._wave(hx, hz, 0x5ad8ff);
        for (const e of this.targets) if (e.kind === "enemy") e.parts.body && e.parts.body.material.color.setHex(0x7ec8e8);
        break;
      case "slow":
        this.slowT = 7;
        Audio.cues.slow();
        this._wave(hx, hz, 0xc9a2ff);
        break;
      case "shield":
        this.shield = true;
        this.shieldDome.visible = true;
        Audio.cues.shield();
        break;
      case "bomb": {
        Audio.cues.bomb();
        this.shake = 1.1;
        this._wave(hx, hz, 0xff7a4a);
        const list = this.targets.filter(x => x.kind === "enemy");
        for (const e of list) {
          this.burst(e.group.position.x, 1.0, e.group.position.z, 0xff9a5c, 20, 3);
          this.score += Math.round(e.score * 0.4 * this._comboMul()); // reduced: no farming
          this.kills++;
          this._removeTarget(e);
        }
        if (this.boss) { this.boss.hp = Math.max(1, this.boss.hp - 1); this._pushHud(); }
        break;
      }
      case "lightning": {
        Audio.cues.lightning();
        this.shake = 0.8;
        const list = this.targets.filter(x => x.kind === "enemy")
          .sort((a, b) => b.group.position.z - a.group.position.z).slice(0, 3);
        for (const e of list) {
          this._lightningBolt(e);
          this.score += Math.round(e.score * 0.5 * this._comboMul());
          this.kills++;
          this._removeTarget(e);
        }
        break;
      }
    }
    this._pushHud();
  }

  _wave(x, z, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    this.scene.add(ring);
    this.waves = this.waves || [];
    this.waves.push({ mesh: ring, t: 0 });
  }

  _lightningBolt(e) {
    const from = new THREE.Vector3(e.group.position.x, 7, e.group.position.z);
    const to = new THREE.Vector3(e.group.position.x, 0.8, e.group.position.z);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const p = from.clone().lerp(to, i / 6);
      if (i > 0 && i < 6) { p.x += (Math.random() - 0.5) * 0.8; p.z += (Math.random() - 0.5) * 0.5; }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe25c, transparent: true, opacity: 1 }));
    this.scene.add(line);
    this.burst(to.x, to.y, to.z, 0xffe25c, 24, 4);
    this.zaps = this.zaps || [];
    this.zaps.push({ mesh: line, t: 0 });
  }

  _floatScore(t, txt) {
    if (!t.el) return;
    const f = document.createElement("div");
    f.className = "floatscore";
    f.textContent = txt;
    this.labelsEl.appendChild(f);
    const r = t.el.getBoundingClientRect(), host = this.labelsEl.getBoundingClientRect();
    f.style.left = (r.left - host.left + r.width / 2) + "px";
    f.style.top = (r.top - host.top) + "px";
    setTimeout(() => f.remove(), 900);
  }

  // ---------------- damage / game over ----------------
  _enemyReaches(t) {
    if (this.shield) {
      this.shield = false;
      this.shieldDome.visible = false;
      this.burst(0, 1.2, HERO_Z, 0x8aff9e, 30, 4);
      Audio.cues.shield();
      this._removeTarget(t);
      return;
    }
    this.hp--;
    this.combo = 0;
    this.heroAnim.hurt = 1;
    this.shake = Math.max(this.shake, 0.7);
    Audio.cues.hurt();
    this.burst(0, 1.2, HERO_Z, 0xff5c5c, 24, 3);
    this._removeTarget(t);
    this._pushHud();
    if (this.hp <= 0) this._endRun();
  }

  _endRun() {
    this.gameOver = true;
    this.running = false;
    this.heroAnim.dead = 1;
    Audio.cues.gameOver();
    const stats = {
      grade: this.grade, score: this.score, kills: this.kills,
      correct: this.correct, attempts: this.attempts,
      bestCombo: this.bestCombo, time: this.time
    };
    setTimeout(() => this.onGameOver && this.onGameOver(stats), 900);
  }

  // ---------------- stage progression ----------------
  _applyStage(i, instant) {
    const s = STAGES[i];
    this.stageIdx = i;
    const set = (obj, prop, hex) => { obj[prop].setHex(hex); };
    if (instant) {
      this.scene.fog.color.setHex(s.fog);
      this.renderer.setClearColor(s.fog);
      this.amb.color.setHex(s.amb);
      this.key.color.setHex(s.key);
      this.rim.color.setHex(s.accent);
      this.floorMat.map = AF.floorTex(s.floor, s.floorLine);
      this.floorMat.needsUpdate = true;
    } else {
      this.stageLerp = { from: { fog: this.scene.fog.color.clone(), amb: this.amb.color.clone(), key: this.key.color.clone(), rim: this.rim.color.clone() }, to: i, t: 0 };
    }
    this.onStage && this.onStage(s.name);
  }

  _updateStageLerp(dt) {
    if (!this.stageLerp) return;
    const L = this.stageLerp, s = STAGES[L.to];
    L.t = Math.min(1, L.t + dt / 6);
    const k = L.t;
    this.scene.fog.color.copy(L.from.fog).lerp(new THREE.Color(s.fog), k);
    this.renderer.setClearColor(this.scene.fog.color);
    this.amb.color.copy(L.from.amb).lerp(new THREE.Color(s.amb), k);
    this.key.color.copy(L.from.key).lerp(new THREE.Color(s.key), k);
    this.rim.color.copy(L.from.rim).lerp(new THREE.Color(s.accent), k);
    if (L.t >= 1) {
      this.floorMat.map = AF.floorTex(s.floor, s.floorLine);
      this.floorMat.needsUpdate = true;
      this.stageLerp = null;
    }
  }

  // ---------------- HUD ----------------
  _pushHud() {
    this.onHud && this.onHud({
      score: this.score, hp: this.hp, maxHp: this.maxHp,
      combo: this.combo, mult: this._comboMul(),
      time: this.time, grade: this.grade,
      bossHp: this.boss ? this.boss.hp : 0, bossMax: this.boss ? this.boss.maxHp : 0,
      stage: STAGES[this.stageIdx].name
    });
  }

  // ---------------- main loop ----------------
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = (now - this._last) / 1000;
    this._last = now;
    this._fps = (this._fps || 60) * 0.95 + (dt > 0 ? 1000 / (dt * 1000) : 60) * 0.05;
    if (dt > 0.1) dt = 0.1; // tab switch guard
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

    const t = now / 1000;

    // idle hero + environment animation (always alive)
    this.heroParts.orb.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.5;
    if (this.heroParts.ring) this.heroParts.ring.rotation.z += dt * 1.6;
    if (this.heroParts.beard) this.heroParts.beard.rotation.x = 0.3 + Math.sin(t * 2.2) * 0.05;
    this.rune.material.opacity = 0.35 + Math.sin(t * 1.4) * 0.12;
    this.rune.rotation.z = t * 0.15;
    for (const tl of this.torchLights) {
      const f = 0.8 + Math.sin(t * 7 + tl.phase) * 0.25;
      tl.light.intensity = f;
      tl.flame.scale.setScalar(0.9 + f * 0.2);
    }
    const dpos = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < this.dustSeed.length; i++) {
      dpos[i * 3 + 1] += dt * 0.35;
      if (dpos[i * 3 + 1] > 6.5) dpos[i * 3 + 1] = 0.2;
      dpos[i * 3] += Math.sin(t + this.dustSeed[i]) * dt * 0.15;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    // hero animations
    const ha = this.heroAnim;
    if (ha.attack > 0) { ha.attack = Math.max(0, ha.attack - dt * 3.2); this.heroParts.staff.rotation.x = -0.9 * Math.sin(ha.attack * Math.PI); }
    if (ha.hurt > 0) { ha.hurt = Math.max(0, ha.hurt - dt * 2.5); this.hero.position.x = Math.sin(ha.hurt * 30) * 0.12 * ha.hurt; }
    if (ha.dead > 0 && this.gameOver) { this.hero.rotation.x = Math.min(Math.PI / 2, this.hero.rotation.x + dt * 1.4); }
    else if (!this.gameOver) { this.hero.rotation.x = 0; this.hero.position.y = Math.sin(t * 2.2) * 0.05; }
    const auraOn = this.combo >= 10 && this.running;
    this.heroAura.material.opacity = auraOn ? 0.5 + Math.sin(t * 5) * 0.2 : 0;
    this.heroAura.scale.setScalar(1 + (this.combo >= 20 ? 0.35 : 0));

    if (this.running) {
      this.time += dt;
      if (this.freezeT > 0) this.freezeT -= dt;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.breather > 0) this.breather -= dt;

      // stage progression every 100s
      const wantStage = Math.min(STAGES.length - 1, Math.floor(this.time / 100));
      if (wantStage !== this.stageIdx && !this.stageLerp) this._applyStage(wantStage);

      // spawning
      if (this.breather <= 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = this._spawnInterval();
          this._spawnEnemy();
        }
      }
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) { this.powerTimer = 26 + Math.random() * 14; this._spawnPowerup(); }
      this.bossTimer -= dt;
      if (this.bossTimer <= 0 && !this.boss) { this.bossTimer = 130 + Math.random() * 30; this._spawnBoss(); }

      // enemies move
      const speedMul = this._speedMul() * (this.freezeT > 0 ? 0 : this.slowT > 0 ? 0.35 : 1);
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const e = this.targets[i];
        if (e.dying) continue;
        if (e.kind === "powerup") {
          e.ttl -= dt;
          if (e.ttl <= 0) { this._removeTarget(e); continue; }
        }
        e.group.position.z += e.speed * speedMul * dt;
        e.bob += dt;
        if (e.type === "bat") { e.group.position.y = 0.55 + Math.sin(e.bob * 5) * 0.25; e.parts.wl.rotation.z = 1.25 + Math.sin(e.bob * 9) * 0.5; e.parts.wr.rotation.z = -1.25 - Math.sin(e.bob * 9) * 0.5; }
        else if (e.type === "ghost") { e.group.position.y = 0.35 + Math.sin(e.bob * 2.4) * 0.3; e.fadeT += dt; const o = 0.55 + Math.sin(e.fadeT * 1.1) * 0.3; e.parts.body.material.opacity = o; e.parts.tail.material.opacity = o * 0.75; if (e.parts.al) { e.parts.al.rotation.z = 0.8 + Math.sin(e.bob * 2.4) * 0.25; e.parts.ar.rotation.z = -0.8 - Math.sin(e.bob * 2.4) * 0.25; } }
        else if (e.type === "slime") {
          const sq = 1 + Math.sin(e.bob * 4) * 0.12;
          e.parts.body.scale.set(1 + (1 - sq) * 0.5, 0.78 * sq, 1 + (1 - sq) * 0.5);
          if (e.parts.mouth) e.parts.mouth.scale.x = 1.3 + Math.sin(e.bob * 4) * 0.3;
          if (e.parts.al) { e.parts.al.rotation.z = 0.9 + Math.sin(e.bob * 3) * 0.3; e.parts.ar.rotation.z = -0.9 - Math.sin(e.bob * 3) * 0.3; }
        }
        else if (e.type === "skeleton") { e.parts.al.rotation.z = 0.35 + Math.sin(e.bob * 4) * 0.25; e.parts.ar.rotation.z = -0.35 - Math.sin(e.bob * 4) * 0.25; }
        else if (e.type === "golem") { e.group.position.x += Math.sin(e.bob * 0.8) * dt * 0.3; if (e.parts.crystal) e.parts.crystal.material.emissiveIntensity = 1.2 + Math.sin(e.bob * 3) * 0.6; if (e.parts.fl) { e.parts.fl.rotation.x = Math.sin(e.bob * 1.6) * 0.25; e.parts.fr.rotation.x = -Math.sin(e.bob * 1.6) * 0.25; } }
        else if (e.kind === "boss") { e.parts.wl.rotation.z = 1.15 + Math.sin(e.bob * 2.2) * 0.35; e.parts.wr.rotation.z = -1.15 - Math.sin(e.bob * 2.2) * 0.35; e.parts.core.material.emissiveIntensity = 1.4 + Math.sin(e.bob * 4) * 0.6; }
        if (e.kind === "powerup") { e.parts.crystal.rotation.y += dt * 2; e.parts.halo.rotation.z += dt * 1.5; if (e.ttl < 4) e.group.visible = Math.sin(e.ttl * 12) > -0.3; }
        if (e.kind !== "powerup" && e.group.position.z >= HIT_Z) { this._enemyReaches(e); continue; }
      }

      this._updateProjectiles(dt);
    }

    // death squash animations
    for (let i = this.dyingList.length - 1; i >= 0; i--) {
      const e = this.dyingList[i];
      e.deathT += dt;
      const k = e.deathT / 0.28;
      if (k >= 1) { this._dispose(e.group); this.scene.remove(e.group); this.dyingList.splice(i, 1); continue; }
      e.group.scale.setScalar((1 + k * 0.4) * (1 - k));
    }

    // shockwave rings
    if (this.waves) for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.t += dt;
      const s = 1 + w.t * 9;
      w.mesh.scale.setScalar(s);
      w.mesh.material.opacity = Math.max(0, 0.9 - w.t * 1.4);
      if (w.t > 0.7) { this.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); this.waves.splice(i, 1); }
    }
    if (this.zaps) for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i]; z.t += dt;
      z.mesh.material.opacity = Math.max(0, 1 - z.t * 5);
      if (z.t > 0.22) { this.scene.remove(z.mesh); z.mesh.geometry.dispose(); this.zaps.splice(i, 1); }
    }

    // particles
    const pl = this.pList;
    for (let i = pl.length - 1; i >= 0; i--) {
      const p = pl[i];
      p.life -= dt * p.decay;
      if (p.life <= 0) { pl.splice(i, 1); continue; }
      p.vy -= dt * 5.5;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (let i = 0; i < this.PMAX; i++) {
      const p = pl[i];
      if (p) {
        this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.y; this.pPos[i * 3 + 2] = p.z;
        this.pCol[i * 3] = p.r * p.life; this.pCol[i * 3 + 1] = p.g * p.life; this.pCol[i * 3 + 2] = p.b * p.life;
      } else { this.pPos[i * 3 + 1] = -999; }
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;

    this._updateStageLerp(dt);

    // camera: fixed portrait + shake
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    this.camera.position.set(
      this.camBase.x + (Math.random() - 0.5) * this.shake * 0.5,
      this.camBase.y + (Math.random() - 0.5) * this.shake * 0.4,
      this.camBase.z
    );
    this.camera.lookAt(this.camLook);

    this.renderer.render(this.scene, this.camera);
    this._syncLabels();
  }

  // project 3D anchors to DOM formula labels, with overlap nudging
  _syncLabels() {
    const host = this.labelsEl.getBoundingClientRect();
    const placed = [];
    const items = this.targets.filter(t => !t.dying && t.el);
    // sort by depth so nearer labels win their slot
    items.sort((a, b) => b.group.position.z - a.group.position.z);
    const v = new THREE.Vector3();
    for (const t of items) {
      const headY = t.kind === "boss" ? 3.1 : t.type === "bat" || t.type === "ghost" ? t.group.position.y + 0.8 : 1.9;
      v.set(t.group.position.x, headY, t.group.position.z).project(this.camera);
      let x = (v.x * 0.5 + 0.5) * host.width;
      let y = (-v.y * 0.5 + 0.5) * host.height;
      // overlap avoidance
      for (const p of placed) {
        if (Math.abs(x - p.x) < 96 && Math.abs(y - p.y) < 34) { y = p.y - 34; }
      }
      placed.push({ x, y });
      t.el.style.transform = "translate(-50%,-100%) translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      const danger = t.kind === "enemy" && t.group.position.z > 2.2;
      t.el.classList.toggle("danger", danger);
      t.el.classList.toggle("targeted", t.targeted);
      t.el.classList.toggle("elite", !!t.elite);
      if (t.kind === "boss") t.el.classList.add("bosslabel");
    }
  }

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // guarantee the battlefield width fits in portrait
    const halfW = 7.2;
    const dist = this.camBase.z - this.camLook.z;
    const tanV = Math.min(Math.tan(THREE.MathUtils.degToRad(75) / 2), Math.max(Math.tan(THREE.MathUtils.degToRad(40) / 2), halfW / (dist * aspect)));
    this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(tanV) * 2);
    this.camera.updateProjectionMatrix();
  }
}
