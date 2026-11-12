/* ============================================================
   Hero — procedural arcane gunner. Suit of dark glass-metal,
   cyan core, staff-cannon. Idle bob, aim tracking, dash,
   recoil, shield arc, collapse.
   ============================================================ */
import * as THREE from 'three';

const ARENA_R = 14.2 - 0.9;

export class Hero {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.scale.setScalar(1.35);
    scene.add(this.root);

    const suit = new THREE.MeshStandardMaterial({
      color: 0x232a4a, metalness: 0.85, roughness: 0.36, envMapIntensity: 1.1,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: 0x101626, metalness: 0.9, roughness: 0.3,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a14, emissive: 0x7df9ff, emissiveIntensity: 2.4,
      metalness: 0.2, roughness: 0.4,
    });
    this.suit = suit; this.coreMat = coreMat;
    this.mats = [suit, trim, coreMat];

    /* torso */
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 6, 12), suit);
    torso.position.y = 1.05; torso.castShadow = true;
    this.root.add(torso);

    /* chest core */
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), coreMat);
    core.position.set(0, 1.25, 0.28);
    this.root.add(core);
    this.core = core;

    /* head + visor */
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), trim);
    head.position.y = 1.72; head.castShadow = true;
    this.root.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0x7df9ff, emissiveIntensity: 3 }));
    visor.position.set(0, 1.72, 0.2);
    this.root.add(visor);

    /* shoulder pads */
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), trim);
      pad.position.set(s * 0.42, 1.48, 0);
      pad.scale.set(1, 0.6, 1); pad.castShadow = true;
      this.root.add(pad);
    }

    /* cloak — simple flared cone, dark */
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x141030, metalness: 0.2, roughness: 0.9, side: THREE.DoubleSide,
    });
    this.cloak = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.85, 14, 1, true), cloakMat);
    this.cloak.position.y = 0.72;
    this.root.add(this.cloak);
    this.cloakMat = cloakMat;

    /* legs */
    const legGeo = new THREE.CapsuleGeometry(0.09, 0.3, 4, 8);
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, suit);
      leg.position.set(s * 0.18, 0.28, 0);
      leg.castShadow = true;
      this.root.add(leg);
      this.legs.push(leg);
    }

    /* staff-cannon on right side, pointing forward (+Z) */
    this.cannon = new THREE.Group();
    this.cannon.position.set(0.56, 1.28, 0.1);
    this.root.add(this.cannon);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 10), trim);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.45;
    barrel.castShadow = true;
    this.cannon.add(barrel);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), coreMat);
    tip.position.z = 1.06;
    this.cannon.add(tip);
    this.tip = tip;

    /* muzzle flash */
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xaefaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.flashSprite.scale.set(1.4, 1.4, 1);
    this.cannon.add(this.flashSprite);
    this.flashSprite.position.z = 1.1;

    this.light = new THREE.PointLight(0x7df9ff, 1.4, 9, 2);
    this.light.position.set(0, 1.3, 0.5);
    this.root.add(this.light);

    /* muzzle world pos helper object */
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0.56, 1.28, 1.15);
    this.root.add(this.muzzle);

    /* shield arc under hero */
    this.shieldRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.08, 48),
      new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    this.shieldRing.rotation.x = -Math.PI / 2;
    this.shieldRing.position.y = 0.05;
    this.root.add(this.shieldRing);

    /* state */
    this.pos = new THREE.Vector3(0, 0, 3);
    this.vel = new THREE.Vector3();
    this.aimAngle = Math.PI;       // faces +Z out of the gate
    this.moveSpeed = 7.2;
    this.dashCd = 0; this.dashCdMax = 2.2; this.dashing = 0;
    this.recoil = 0;
    this.dead = false;
    this.deadT = 0;
    this.pips = 6; this.maxPips = 6;
    this._walk = 0;
    this._lightBase = 1.4;
  }

  muzzleWorld(out) {
    return this.muzzle.getWorldPosition(out);
  }

  setPips(p, max) {
    this.pips = p; this.maxPips = max;
    const k = max > 0 ? p / max : 0;
    this.shieldRing.material.opacity = 0.18 + k * 0.55;
    this.shieldRing.scale.setScalar(0.8 + k * 0.35);
    this.shieldRing.visible = p > 0;
  }

  fire() {
    this.recoil = 1;
    this.flashSprite.material.opacity = 1;
    this.light.intensity = 6;
  }

  hitFlash() {
    this.coreMat.emissive.set(0xff5f6d);
    this.light.color.set(0xff5f6d);
    setTimeout(() => {
      this.coreMat.emissive.set(0x7df9ff);
      this.light.color.set(0x7df9ff);
    }, 220);
  }

  collapse() {
    this.dead = true; this.deadT = 0;
  }

  reset() {
    this.dead = false; this.deadT = 0;
    this.pos.set(0, 0, 3); this.vel.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.dashCd = 0; this.pips = 6; this.maxPips = 6;
  }

  update(dt, keys, aimAngle, vfx, slow) {
    const root = this.root;

    if (this.dead) {
      /* fall + fade the core */
      this.deadT += dt;
      root.rotation.x = Math.min(Math.PI / 2, this.deadT * 2.2);
      root.position.y = -Math.pow(Math.max(0, this.deadT - 0.35), 1.6) * 4;
      const d = Math.max(0, 1 - this.deadT * 0.5);
      this.light.intensity = d * 1.4;
      this.coreMat.emissiveIntensity = d * 2.4;
      return;
    }

    /* --- movement --- */
    const dirX = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const dirZ = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    const moving = dirX !== 0 || dirZ !== 0;
    const spd = this.moveSpeed * (slow < 1 ? 1 : 1);

    let vx = 0, vz = 0;
    if (moving) {
      const l = Math.hypot(dirX, dirZ);
      vx = (dirX / l) * spd; vz = (dirZ / l) * spd;
    }
    if (this.dashing > 0) {
      this.dashing -= dt;
      vx = this.dashVX; vz = this.dashVZ;
      vfx.particles.spawn(
        new THREE.Vector3(this.pos.x, 0.6, this.pos.z),
        new THREE.Vector3(0, 0.4, 0), new THREE.Color(0x7df9ff),
        { size: 8, dur: 0.4, drag: 3 });
    } else {
      this.dashCd = Math.max(0, this.dashCd - dt);
    }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x + vx * dt, -ARENA_R, ARENA_R);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z + vz * dt, -ARENA_R, ARENA_R);

    root.position.x = this.pos.x;
    root.position.z = this.pos.z;

    /* --- aim --- */
    this.aimAngle += (aimAngle - this.aimAngle) * Math.min(1, dt * 12);
    root.rotation.y = this.aimAngle;

    /* --- idle + walk animation --- */
    const t = performance.now() * 0.001;
    this._walk += (moving ? dt * 9 : 0);
    const walk = this._walk;
    root.position.y = moving ? Math.abs(Math.sin(walk)) * 0.09 : Math.sin(t * 2.2) * 0.05 + 0.03;
    this.legs[0].rotation.x = moving ? Math.sin(walk) * 0.7 : 0;
    this.legs[1].rotation.x = moving ? -Math.sin(walk) * 0.7 : 0;
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, moving ? 0.06 : 0, dt * 6);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, moving ? -0.08 : 0, dt * 6);
    this.cloak.rotation.x = 0.25 + Math.sin(t * 1.8) * 0.06 + (moving ? 0.2 : 0);
    this.core.rotation.y = t * 1.6;
    this.core.rotation.x = t * 0.9;
    this.coreMat.emissiveIntensity = 2.4 + Math.sin(t * 3) * 0.5;

    /* cannon recoil + flash */
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.cannon.position.z = 0.1 - this.recoil * 0.22;
    this.flashSprite.material.opacity = Math.max(0, this.flashSprite.material.opacity - dt * 6);
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    this.light.intensity = THREE.MathUtils.lerp(this.light.intensity, this._lightBase, dt * 10);

    /* shield arc shimmer */
    this.shieldRing.rotation.z = t * 0.6;
  }

  dash(dirX, dirZ, mult) {
    if (this.dashCd > 0 || this.dead) return false;
    const l = Math.hypot(dirX, dirZ) || 1;
    const range = 9 * mult;
    this.dashVX = (dirX / l) * range * 2.2;
    this.dashVZ = (dirZ / l) * range * 2.2;
    this.dashing = 0.18;
    this.dashCd = this.dashCdMax * mult;
    return true;
  }
}
