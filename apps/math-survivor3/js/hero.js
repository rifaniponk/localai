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

    /* ---- palette from the reference sheet ---- */
    const std = (color, rough = 0.55, metal = 0.12) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.9 });
    const jacket = std(0x2563eb, 0.62, 0.15);          // primary jacket
    const white  = std(0xf3f4f6, 0.5, 0.2);            // secondary armor
    const pants  = std(0x1f2937, 0.75, 0.1);           // pants / base
    const skin   = std(0xf2c9a3, 0.7, 0.05);           // face
    const hairM  = std(0xeef0f8, 0.58, 0.1);           // silver hair
    const darkM  = std(0x2a3049, 0.5, 0.55);           // gloves / grip / metal
    const scarfM = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.65, side: THREE.DoubleSide, envMapIntensity: 0.8 });
    const soleM  = std(0xfbbf24, 0.5, 0.2);            // boot soles
    const glowMat = new THREE.MeshStandardMaterial({   // cyan energy
      color: 0x08111c, emissive: 0x06b6d4, emissiveIntensity: 2.6, roughness: 0.35, metalness: 0.2,
    });
    this.suit = jacket; this.coreMat = glowMat;
    this.mats = [jacket, white, pants, glowMat];

    /* ---- legs: dark pants + white boots with yellow soles ---- */
    const shinGeo = new THREE.CapsuleGeometry(0.11, 0.22, 4, 8);
    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.17, 0.32, 0);
      const shin = new THREE.Mesh(shinGeo, pants);
      shin.position.y = -0.05; shin.castShadow = true;
      leg.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), white);
      boot.position.set(0, -0.16, 0.04); boot.castShadow = true;
      leg.add(boot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.32), soleM);
      sole.position.set(0, -0.24, 0.04);
      leg.add(sole);
      this.root.add(leg);
      this.legs.push(leg);
    }

    /* ---- torso: blue jacket + white chest armor + cyan core ---- */
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 12), jacket);
    torso.position.y = 1.0; torso.castShadow = true;
    this.root.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.2), white);
    chest.position.set(0, 1.12, 0.16); chest.castShadow = true;
    this.root.add(chest);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), glowMat);
    core.position.set(0, 1.14, 0.28);
    this.root.add(core);
    this.core = core;

    /* ---- belt + leather pouch ---- */
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.3), darkM);
    belt.position.set(0, 0.72, 0);
    this.root.add(belt);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.1), std(0x9a6b3f, 0.7, 0.05));
    pouch.position.set(-0.26, 0.62, 0.08);
    this.root.add(pouch);

    /* ---- yellow scarf: wrap + flowing ribbon ---- */
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 16), scarfM);
    wrap.rotation.x = Math.PI / 2; wrap.position.y = 1.32;
    this.root.add(wrap);
    const ribbonGeo = new THREE.ConeGeometry(0.17, 0.75, 8, 1, true);
    ribbonGeo.rotateX(-2.62);           // tip trails down-back; update() flaps it
    this.cloak = new THREE.Mesh(ribbonGeo, scarfM);
    this.cloak.position.set(0, 1.24, -0.3);
    this.root.add(this.cloak);
    this.cloakMat = scarfM;

    /* ---- chibi head: tan face + silver spiky hair ---- */
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), skin);
    head.position.y = 1.62; head.castShadow = true;
    this.root.add(head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), darkM);
      eye.position.set(s * 0.1, 1.66, 0.24);
      eye.scale.set(1, 1.2, 0.5);
      this.root.add(eye);
    }
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
    hairCap.position.y = 1.64; hairCap.rotation.x = -0.25;
    this.root.add(hairCap);
    const spikeGeo = new THREE.ConeGeometry(0.09, 0.42, 6);
    const spikes = [[0, -0.5, -0.14, 0, -0.25, 0.06], [0.16, -0.9, -0.14, 0, -0.25, 0.06],
      [-0.16, -0.9, -0.14, 0, -0.25, 0.06], [0.12, 0.5, 0.12, 0.9, 0.3, -0.02],
      [-0.12, 0.5, 0.12, 0.9, 0.3, -0.02]];
    for (const [sx, tilt, sz, rX, baseX, yOff] of spikes) {
      const sp = new THREE.Mesh(spikeGeo, hairM);
      sp.position.set(sx, 1.86 + yOff, sz);
      sp.rotation.z = tilt; sp.rotation.x = rX;
      sp.castShadow = true;
      this.root.add(sp);
    }

    /* ---- shoulder pads (white armor) ---- */
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white);
      pad.position.set(s * 0.36, 1.32, 0);
      pad.scale.set(1, 0.65, 1); pad.castShadow = true;
      this.root.add(pad);
    }

    /* ---- blaster: white body, dark grip, cyan barrel glow, pointing +Z ---- */
    this.cannon = new THREE.Group();
    this.cannon.position.set(0.42, 1.0, 0.12);
    this.root.add(this.cannon);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.66), white);
    body.position.z = 0.3; body.castShadow = true;
    this.cannon.add(body);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.2), darkM);
    sight.position.set(0, 0.15, 0.22);
    this.cannon.add(sight);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.15), darkM);
    grip.position.set(0, -0.2, 0.02); grip.rotation.x = 0.5;
    this.cannon.add(grip);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), glowMat);
    tip.position.z = 0.68;
    this.cannon.add(tip);
    this.tip = tip;

    /* muzzle flash — soft radial glow, kept small so the blast never whites out */
    const fc = document.createElement('canvas'); fc.width = fc.height = 64;
    const fg = fc.getContext('2d');
    const fgr = fg.createRadialGradient(32, 32, 0, 32, 32, 32);
    fgr.addColorStop(0, 'rgba(255,255,255,1)');
    fgr.addColorStop(0.35, 'rgba(255,255,255,.55)');
    fgr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = fgr; fg.fillRect(0, 0, 64, 64);
    const flashTex = new THREE.CanvasTexture(fc);
    flashTex.colorSpace = THREE.SRGBColorSpace;
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, color: 0xaefaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.flashSprite.scale.set(0.7, 0.7, 1);
    this.cannon.add(this.flashSprite);
    this.flashSprite.position.z = 0.85;

    this.light = new THREE.PointLight(0x06b6d4, 1.4, 9, 2);
    this.light.position.set(0, 1.3, 0.5);
    this.root.add(this.light);

    /* muzzle world pos helper object */
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0.42, 1.0, 0.92);
    this.root.add(this.muzzle);

    /* shield arc under hero */
    this.shieldRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.08, 48),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5,
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
    this.flashSprite.material.opacity = 0.6;
  }

  hitFlash() {
    this.coreMat.emissive.set(0xff5f6d);
    this.light.color.set(0xff5f6d);
    setTimeout(() => {
      this.coreMat.emissive.set(0x06b6d4);
      this.light.color.set(0x06b6d4);
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
        new THREE.Vector3(0, 0.4, 0), new THREE.Color(0x06b6d4),
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
    this.cannon.position.z = 0.12 - this.recoil * 0.18;
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
