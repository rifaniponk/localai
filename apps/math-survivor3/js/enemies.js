/* ============================================================
   Enemies — shardlings, golems, wisps, sentinels, and the
   Calculus Titan. Every enemy carries an arithmetic sigil on a
   floating glyph. Procedural PBR bodies, dissolve-on-death.
   ============================================================ */
import * as THREE from 'three';
import { makeDissolvable, releaseDissolvable } from './vfx.js';
import { generateBatch } from './mathengine.js';
import { ARENA_R } from './world.js';

const V = new THREE.Vector3();

/* ---------------- sigil glyph (canvas sprite) ---------------- */
function makeSigilTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.font = `700 ${text.length > 8 ? 52 : 64}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,196,107,.9)'; g.shadowBlur = 22;
  g.fillStyle = '#ffe9c8';
  g.fillText(text, 128, 62);
  g.shadowBlur = 0;
  g.fillStyle = '#ffc46b';
  g.fillText(text, 128, 62);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSigil(text) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSigilTexture(text), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const w = 2.6 + Math.min(1.6, text.length * 0.12);
  sprite.scale.set(w, w * 0.5, 1);
  return sprite;
}

/* ---------------- shared geometry / material helpers ---------------- */
const GEO = {
  octa: new THREE.OctahedronGeometry(0.52, 0),
  inner: new THREE.OctahedronGeometry(0.3, 0),
  box: new THREE.BoxGeometry(1.15, 1.0, 1.15),
  plate: new THREE.BoxGeometry(0.5, 0.42, 0.16),
  sphere: new THREE.SphereGeometry(0.32, 14, 10),
  torus: new THREE.TorusGeometry(0.55, 0.07, 8, 28),
  core: new THREE.IcosahedronGeometry(1.7, 1),
  ringBig: new THREE.TorusGeometry(2.4, 0.18, 8, 48),
  botBody: new THREE.SphereGeometry(0.42, 16, 12),
  lens: new THREE.SphereGeometry(0.15, 12, 10),
  botLeg: new THREE.CapsuleGeometry(0.045, 0.26, 3, 6),
  crabBody: new THREE.BoxGeometry(0.9, 0.5, 0.7),
  claw: new THREE.BoxGeometry(0.24, 0.2, 0.34),
  visor: new THREE.BoxGeometry(0.52, 0.1, 0.1),
  shield: new THREE.BoxGeometry(0.82, 0.62, 0.08),
  dome: new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  legTube: new THREE.CapsuleGeometry(0.04, 0.42, 3, 6),
  spiderLeg: new THREE.CapsuleGeometry(0.06, 0.7, 3, 6),
};

const MAT = {
  shard: new THREE.MeshStandardMaterial({ color: 0x3a2a5e, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.4 }),
  ember: new THREE.MeshStandardMaterial({ color: 0x201018, emissive: 0xffc46b, emissiveIntensity: 2.2, roughness: 0.5 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x2b2440, metalness: 0.6, roughness: 0.55 }),
  armor: new THREE.MeshStandardMaterial({ color: 0x4a4266, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.2 }),
  wisp: new THREE.MeshStandardMaterial({ color: 0x0c0a18, emissive: 0xa085ff, emissiveIntensity: 2.6, roughness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x241d38, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.3 }),
  titan: new THREE.MeshStandardMaterial({ color: 0x1c1430, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 }),
  titanCore: new THREE.MeshStandardMaterial({ color: 0x180b14, emissive: 0xff5f6d, emissiveIntensity: 2.0, roughness: 0.4 }),
  /* reference-sheet palette: white units, cyan optics, yellow accents */
  eWhite: new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 0.4, roughness: 0.42, envMapIntensity: 1.0 }),
  eMetal: new THREE.MeshStandardMaterial({ color: 0x5f6b7a, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.1 }),
  eLens: new THREE.MeshStandardMaterial({ color: 0x061418, emissive: 0x06b6d4, emissiveIntensity: 2.8, roughness: 0.3 }),
  eYellow: new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.35, roughness: 0.45 }),
  ePurple: new THREE.MeshStandardMaterial({ color: 0x45306b, metalness: 0.6, roughness: 0.4, envMapIntensity: 1.2 }),
  eRed: new THREE.MeshStandardMaterial({ color: 0x1a0a10, emissive: 0xff3d4e, emissiveIntensity: 2.4, roughness: 0.4 }),
  eOrange: new THREE.MeshStandardMaterial({ color: 0xff7a3d, metalness: 0.4, roughness: 0.45 }),
};

/* =================================================================== */
/* Enemy                                                                */
/* =================================================================== */

let ENEMY_ID = 0;

class Enemy {
  constructor(manager, def, quest) {
    this.mgr = manager;
    this.def = def;
    this.id = ++ENEMY_ID;
    this.value = quest.value;
    this.expr = quest.text;
    this.alive = true;
    this.hp = def.hp ?? 1;
    this.radius = def.radius ?? 0.9;
    this.state = 'spawn';           // spawn | active | charging
    this.spawnT = 0;
    this.knock = new THREE.Vector3();
    this.slowT = 0;
    this.contactCd = 0;
    this.chargeT = 0;

    this.group = new THREE.Group();
    manager.scene.add(this.group);

    const pos = def.pickSpawn();
    this.group.position.copy(pos);
    this.group.position.y = 0.2;
    this.buildBody();

    /* per-enemy cloned materials + dissolve capability */
    this.dissolves = [];
    this.body.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        const d = makeDissolvable(o.material, { edge: def.edgeColor ?? 0xffc46b });
        this.dissolves.push(d);
      }
    });

    /* sigil */
    this.sigil = makeSigil(this.expr);
    this.sigil.position.y = this.def.sigilY ?? 1.9;
    this.sigil.material.opacity = 0;
    this.sigil.material.depthTest = false;   /* always readable, never occluded */
    this.sigil.renderOrder = 999;
    this.sigil.scale.multiplyScalar(1.25);
    this.group.add(this.sigil);
  }

  buildBody() {
    this.meshes = [];
    const def = this.def;
    const body = def.build(this);
    body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.body = body;
    if (!def.boss) body.scale.setScalar(1.35);
    this.group.add(body);
  }

  aimPoint() {
    return this.group.position.clone().setY(this.def.aimY ?? 1.1);
  }

  /* first contact / first hit sheds armor */
  takeHit(dmg = 1) {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hp <= 0) return true; // dies
    /* golem armor shed */
    this.def.onSurvive?.(this);
    return false;
  }

  beginDissolve() {
    this.alive = false;
    this.sigil.visible = false;
    this.dissolveT = 0;
  }

  update(dt, game) {
    const g = this.group;

    /* dissolve animation */
    if (this.dissolveT !== undefined) {
      this.dissolveT += dt * 2.1;
      const v = Math.min(1, this.dissolveT);
      for (const d of this.dissolves) d.uDissolve.value = v;
      g.position.y -= dt * 0.6;
      if (this.dissolveT >= 1) {
        this.mgr.retire(this);
        return;
      }
    }

    if (!this.alive) { this.def.update?.(this, dt, game, true); return; }

    /* spawn rise */
    if (this.state === 'spawn') {
      this.spawnT += dt * 2.4;
      const k = Math.min(1, this.spawnT);
      g.position.y = THREE.MathUtils.lerp(0.2, this.def.baseY ?? 0.9, k);
      g.scale.setScalar(k * 0.4 + 0.6);
      this.sigil.material.opacity = k;
      if (k >= 1) { this.state = 'active'; g.scale.setScalar(1); }
      this.def.update?.(this, dt, game, true);
      return;
    }

    this.def.update?.(this, dt, game);

    /* knockback + slow decay */
    if (this.knock.lengthSq() > 0.01) {
      g.position.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    }
    if (this.slowT > 0) this.slowT -= dt;

    /* clamp inside arena */
    const r = Math.hypot(g.position.x, g.position.z);
    const maxR = ARENA_R + 1.4;
    if (r > maxR) {
      g.position.x *= maxR / r; g.position.z *= maxR / r;
    }

    /* sigil float + face player */
    this.sigil.position.y = (this.def.sigilY ?? 1.9) + Math.sin(performance.now() * 0.002 + this.id) * 0.12;

    /* contact damage */
    this.contactCd = Math.max(0, this.contactCd - dt);
    const dx = g.position.x - game.hero.pos.x, dz = g.position.z - game.hero.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.3 && this.contactCd <= 0 && !this.def.ranged) {
      this.contactCd = 1.2;
      game.onHeroHit(this);
      /* push enemy back */
      const l = Math.sqrt(d2) || 1;
      this.knock.set(dx / l * -7, 0, dz / l * -7);
    }
  }
}

/* =================================================================== */
/* Enemy definitions                                                    */
/* =================================================================== */

function hoverUpdate(e, dt, game, dead) {
  if (dead) { e.body.rotation.y += dt * 0.4; return; }
  const t = performance.now() * 0.001 + e.id;
  e.group.position.y = (e.def.baseY ?? 0.9) + Math.sin(t * 2.1) * 0.18;
  e.body.rotation.y += dt * 1.4;
  e.body.rotation.x = Math.sin(t * 1.3) * 0.3;
}

/* hover animation + drift toward the hero — shardlings stay a real threat */
function hoverSeek(e, dt, game, dead) {
  hoverUpdate(e, dt, game, dead);
  if (!dead) seek(e, dt);
}

function seek(e, dt, speedMul = 1) {
  const g = e.group;
  const hero = e.mgr.game.hero.pos;
  const dx = hero.x - g.position.x, dz = hero.z - g.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const speed = e.def.speed * speedMul * (e.slowT > 0 ? 0.35 : 1);
  g.position.x += (dx / d) * speed * dt;
  g.position.z += (dz / d) * speed * dt;
}

const DEFS = {
  shardling: {
    hp: 1, radius: 0.85, speed: 2.0, edgeColor: 0xffc46b, aimY: 1.0,
    pickSpawn() {
      const a = Math.random() * Math.PI * 2;
      const r = ARENA_R * (0.55 + Math.random() * 0.4);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    },
    build(e) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(GEO.botBody, MAT.eWhite);
      shell.position.y = 0.66;
      const lens = new THREE.Mesh(GEO.lens, MAT.eLens);
      lens.position.set(0, 0.66, 0.36);
      lens.scale.set(1, 1, 0.55);
      g.add(shell, lens);
      e.botLegs = [];
      for (const s2 of [-1, 1]) {
        const leg = new THREE.Mesh(GEO.botLeg, MAT.eMetal);
        leg.position.set(s2 * 0.17, 0.28, 0);
        g.add(leg);
        e.botLegs.push(leg);
      }
      return g;
    },
    update: hoverSeek,
  },

  golem: {
    hp: 2, radius: 1.15, speed: 1.15, edgeColor: 0xffc46b, aimY: 1.2, baseY: 0.55,
    pickSpawn() {
      const a = Math.random() * Math.PI * 2;
      const r = ARENA_R * (0.7 + Math.random() * 0.3);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    },
    build(e) {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(GEO.box, MAT.ePurple);
      torso.position.y = 0.62;
      g.add(torso);
      const core = new THREE.Mesh(GEO.lens, MAT.eRed);
      core.position.set(0, 0.68, 0.58);
      core.scale.setScalar(1.25);
      g.add(core);
      e.armorPlates = [];
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(GEO.plate, MAT.eWhite);
        const a = (i / 4) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.64, 0.67, Math.sin(a) * 0.64);
        p.rotation.y = -a;
        g.add(p);
        e.armorPlates.push(p);
      }
      return g;
    },
    onSurvive(e) {
      /* shed one armor plate */
      const p = e.armorPlates.pop();
      if (p) {
        p.material = p.material.clone();
        const d = makeDissolvable(p.material, { edge: 0xbfc9ff });
        e.mgr.armorShed(d, p);
      }
    },
    update(e, dt, game, dead) {
      if (dead) return;
      const t = performance.now() * 0.001 + e.id;
      e.body.position.y = Math.abs(Math.sin(t * 3.2)) * 0.06;
      seek(e, dt);
    },
  },

  wisp: {
    hp: 1, radius: 0.7, speed: 0, edgeColor: 0x7df0ff, aimY: 1.2, ranged: false,
    pickSpawn() {
      const a = Math.random() * Math.PI * 2;
      const r = ARENA_R * (0.7 + Math.random() * 0.25);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    },
    build(e) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(GEO.crabBody, MAT.eWhite);
      shell.position.y = 0.55;
      g.add(shell);
      const visor = new THREE.Mesh(GEO.visor, MAT.eLens);
      visor.position.set(0, 0.64, 0.37);
      g.add(visor);
      const shield = new THREE.Mesh(GEO.shield, MAT.eMetal);
      shield.position.set(0, 0.5, 0.5);
      g.add(shield);
      e.claws = [];
      for (const s2 of [-1, 1]) {
        const claw = new THREE.Mesh(GEO.claw, MAT.eYellow);
        claw.position.set(s2 * 0.64, 0.34, 0.34);
        g.add(claw);
        e.claws.push(claw);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0x06b6d4, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(1.8, 1.8, 1);
      g.add(glow);
      return g;
    },
    update(e, dt, game, dead) {
      if (dead) { e.body.rotation.y += dt; return; }
      const t = performance.now() * 0.001 + e.id;
      e.group.position.y = 1.1 + Math.sin(t * 3) * 0.15;
      const heroP = e.mgr.game.hero.pos;
      e.body.rotation.y = Math.atan2(heroP.x - e.group.position.x, heroP.z - e.group.position.z);
      e.hopT = (e.hopT ?? 1.2) - dt;
      if (e.hopT <= 0) {
        e.hopT = 1.6 - Math.min(0.8, e.mgr.game.wave * 0.03);
        const g = e.group, hero = e.mgr.game.hero.pos;
        e.mgr.vfx.spawnRing(g.position, 0x06b6d4, 1.6, 0.4);
        const dx = hero.x - g.position.x, dz = hero.z - g.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const step = Math.min(d, 2.8);
        g.position.x += (dx / d) * step;
        g.position.z += (dz / d) * step;
        e.mgr.vfx.spawnRing(g.position, 0x06b6d4, 1.6, 0.4);
        e.mgr.audio.fx.dash();
      }
    },
  },

  sentinel: {
    hp: 1, radius: 1.0, speed: 1.6, edgeColor: 0x7df0ff, aimY: 1.4, ranged: true,
    pickSpawn() {
      const a = Math.random() * Math.PI * 2;
      const r = ARENA_R * (0.85 + Math.random() * 0.12);
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    },
    build(e) {
      const g = new THREE.Group();
      const dome = new THREE.Mesh(GEO.dome, MAT.eWhite);
      dome.position.y = 0.85; dome.scale.set(1, 1.25, 1);
      g.add(dome);
      const core = new THREE.Mesh(GEO.lens, MAT.eLens);
      core.position.set(0, 0.95, 0.3); core.scale.setScalar(1.3);
      g.add(core);
      const ring = new THREE.Mesh(GEO.torus, MAT.eMetal);
      ring.position.y = 0.95; ring.scale.setScalar(0.6);
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(GEO.legTube, MAT.eMetal);
        leg.position.set(Math.cos(a) * 0.34, 0.32, Math.sin(a) * 0.34);
        leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5;
        g.add(leg);
      }
      e.ring = ring; e.core = core;
      return g;
    },
    update(e, dt, game, dead) {
      if (dead) { e.ring.rotation.z += dt; return; }
      const t = performance.now() * 0.001;
      e.ring.rotation.z += dt * 2.5;
      e.ring.rotation.x = Math.sin(t) * 0.4;
      const g = e.group, hero = e.mgr.game.hero.pos;
      const dx = hero.x - g.position.x, dz = hero.z - g.position.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 8) {
        const speed = e.def.speed * (e.slowT > 0 ? 0.35 : 1);
        g.position.x += (dx / d) * speed * dt;
        g.position.z += (dz / d) * speed * dt;
      } else if (e.state !== 'charging') {
        e.state = 'charging';
        e.chargeT = 0;
      }
      if (e.state === 'charging' && e.alive) {
        e.chargeT += dt;
        const chargeDur = 7;
        const k = Math.min(1, e.chargeT / chargeDur);
        e.core.scale.setScalar(1.1 + k * 0.8);
        e.core.material.emissiveIntensity = 2.0 + k * 4;
        if (Math.random() < dt * 8 * k) {
          V.copy(g.position); V.y = 1.1;
          e.mgr.vfx.particles.spawn(V, new THREE.Vector3(0, 1.5, 0), new THREE.Color(0x06b6d4), { size: 5, dur: 0.3 });
        }
        if (k >= 1) {
          e.state = 'active';
          e.chargeT = 0;
          e.core.scale.setScalar(1.1);
          e.core.material.emissiveIntensity = 2.0;
          const from = g.position.clone().setY(1.1);
          const to = hero.clone().setY(0.8);
          e.mgr.vfx.beam(from, to, 0x06b6d4, 0.4, 2.5);
          e.mgr.audio.fx.hurt();
          game.onHeroHit(e, true);
        }
      }
    },
  },

  /* ------------- boss ------------- */
  titan: {
    hp: 3, radius: 2.4, speed: 0.6, edgeColor: 0xff5f6d, aimY: 2.2, boss: true, baseY: 1.2,
    pickSpawn() {
      const a = Math.random() * Math.PI * 2;
      const r = ARENA_R * 0.92;
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    },
    build(e) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.9), MAT.eWhite);
      shell.position.y = 1.9;
      const accent = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 2.0), MAT.eOrange);
      accent.position.y = 2.32;
      g.add(shell, accent);
      const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), MAT.titanCore);
      heart.position.set(0, 1.75, 0.98);
      e.heart = heart;
      g.add(heart);
      e.legs = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leg = new THREE.Mesh(GEO.spiderLeg, MAT.eMetal);
        leg.position.set(Math.cos(a) * 1.15, 1.5, Math.sin(a) * 1.3);
        leg.rotation.z = Math.cos(a) * 1.1; leg.rotation.x = -Math.sin(a) * 1.1;
        g.add(leg);
        e.legs.push(leg);
      }
      e.rings = [];
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(GEO.ringBig, MAT.eMetal);
        r.position.y = 1.9;
        r.rotation.set(Math.random() * 1, Math.random() * 1, Math.random() * 1);
        r.scale.setScalar(1 - i * 0.18);
        g.add(r);
        e.rings.push(r);
      }
      return g;
    },
    onSurvive(e) {
      /* one orbit ring shatters per hit survived */
      const r = e.rings.pop();
      if (r) {
        r.material = r.material.clone();
        const d = makeDissolvable(r.material, { edge: 0xff9f6b });
        e.mgr.armorShed(d, r);
      }
    },
    update(e, dt, game, dead) {
      if (dead) {
        e.rings.forEach((r, i) => { r.rotation.z += dt * (1 + i); });
        return;
      }
      const t = performance.now() * 0.001;
      e.rings.forEach((r, i) => {
        r.rotation.x += dt * (0.6 + i * 0.3);
        r.rotation.y += dt * (0.4 + i * 0.2);
      });
      e.heart.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
      seek(e, dt, 1);
      /* keep at range ~7 */
      const g = e.group, hero = e.mgr.game.hero.pos;
      const d = Math.hypot(hero.x - g.position.x, hero.z - g.position.z) || 1;
      if (d < 7) {
        g.position.x -= ((hero.x - g.position.x) / d) * e.def.speed * dt * 1.6;
        g.position.z -= ((hero.z - g.position.z) / d) * e.def.speed * dt * 1.6;
      }
      /* spawn shardlings */
      e.spawnT = (e.spawnT ?? 4) - dt;
      if (e.spawnT <= 0 && e.mgr.countAlive() < 24) {
        e.spawnT = 5;
        e.mgr.spawnOne('shardling', e.mgr.game.nextQuest());
        e.mgr.audio.fx.horn();
      }
    },
  },
};

/* =================================================================== */
/* Manager                                                              */
/* =================================================================== */

export class Enemies {
  constructor(scene, vfx, audio, game) {
    this.scene = scene;
    this.vfx = vfx;
    this.audio = audio;
    this.game = game;
    this.list = [];
    this.queue = [];
    this.spawnTimer = 0;
    this.waveTotal = 0;
    this.armorSheds = [];
  }

  countAlive() { return this.list.filter(e => e.alive).length; }

  nextQuest() {
    return this.game.nextQuest();
  }

  spawnOne(type, quest) {
    const def = DEFS[type];
    const e = new Enemy(this, def, quest);
    this.list.push(e);
    this.vfx.spawnRing(e.group.position, type === 'titan' ? 0xff5f6d : 0xa085ff, 3, 0.7);
    return e;
  }

  startWave(wave) {
    this.list.length = 0; this.queue.length = 0;
    this.spawnTimer = 0.8;
    const isBoss = wave > 8 && (wave - 8) % 8 === 0;
    if (isBoss) {
      const q = this.nextQuest();
      this.spawnOne('titan', { ...q, text: q.text });
      for (let i = 0; i < 3; i++)
        this.queue.push({ t: 1.5 + i * 2.5, type: 'shardling' });
      this.waveTotal = 4;
      this.audio.fx.bossSting();
      return { boss: true };
    }
    const total = Math.min(20, 5 + Math.floor(wave * 1.5));
    const kinds = [];
    const nSent = wave >= 5 ? Math.min(3, 1 + Math.floor(wave / 6)) : 0;
    const nGolem = wave >= 3 ? Math.min(4, 1 + Math.floor(wave / 4)) : 0;
    const nWisp = wave >= 6 ? Math.min(4, 1 + Math.floor((wave - 6) / 4)) : 0;
    for (let i = 0; i < nSent; i++) kinds.push('sentinel');
    for (let i = 0; i < nGolem; i++) kinds.push('golem');
    for (let i = 0; i < nWisp; i++) kinds.push('wisp');
    while (kinds.length < total) kinds.push('shardling');
    /* shuffle */
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    kinds.forEach((k, i) => this.queue.push({
      t: i === 0 ? 0.6 : (1.7 - Math.min(1.0, wave * 0.05)),
      type: k,
    }));
    this.waveTotal = total;
    return { boss: false };
  }

  spawnOneQueued(item) {
    this.spawnOne(item.type, this.nextQuest());
  }

  /* matches for the player's typed value */
  matchesFor(value) {
    return this.list.filter(e => e.alive && e.value === value);
  }

  kill(e, color = 0xffc46b) {
    if (!e.alive) return;
    e.beginDissolve();
    this.vfx.killBurst(e.aimPoint(), new THREE.Color(color));
  }

  armorShed(dissolveEntry, mesh) {
    /* armor plates pop off and dissolve near-instantly */
    this.armorSheds.push({ d: dissolveEntry, mesh, t: 0 });
    this.audio.fx.impact();
  }

  retire(e) {
    this.scene.remove(e.group);
    e.dissolves.forEach(releaseDissolvable);
    e.sigil.material.map.dispose();
    e.sigil.material.dispose();
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  clearAll(color) {
    for (const e of [...this.list]) {
      if (e.alive) { e.beginDissolve(); }
    }
    void color;
  }

  reset() {
    for (const e of [...this.list]) this.retire(e);
    this.list.length = 0; this.queue.length = 0;
    this.armorSheds.forEach(s => releaseDissolvable(s.d));
    this.armorSheds.length = 0;
  }

  update(dt, game) {
    /* spawn queue */
    this.spawnTimer += dt;
    const next = this.queue[0];
    if (next && this.spawnTimer >= next.t && this.countAlive() < 26) {
      this.queue.shift();
      this.spawnTimer = 0;
      this.spawnOneQueued(next);
    }

    for (const e of [...this.list]) e.update(dt, game);

    /* armor sheds */
    for (const s of [...this.armorSheds]) {
      s.t += dt * 3;
      s.d.uDissolve.value = Math.min(1, s.t);
      if (s.t >= 1) {
        s.mesh.visible = false;
        releaseDissolvable(s.d);
        this.armorSheds.splice(this.armorSheds.indexOf(s), 1);
      }
    }
  }
}
