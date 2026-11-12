/* ============================================================
   VFX — pooled particles, homing projectiles, shockwave rings,
   beams, floating value popups, dissolve-shader helper,
   camera trauma shake + hit-stop time dilation.
   ============================================================ */
import * as THREE from 'three';

const V3 = new THREE.Vector3();
const V3B = new THREE.Vector3();

/* soft round sprite texture */
function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* dissolve-on-death shader injection for standard materials */
const dissolvables = [];
export function makeDissolvable(material, opts = {}) {
  const uDissolve = { value: 0 };
  const edge = new THREE.Color(opts.edge ?? 0x7df9ff);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uDissolve;
    shader.uniforms.uEdgeColor = { value: edge };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vDissWorld;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvDissWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        `#include <common>
        varying vec3 vDissWorld;
        uniform float uDissolve;
        uniform vec3 uEdgeColor;
        float dsshash( vec2 p ){ return fract( 43758.5453 * sin( dot( p, vec2( 12.9898, 78.233 ) ) ) ); }`)
      .replace('#include <dithering_fragment>',
        `vec2 dnSeed = floor( vDissWorld.xz * 7.0 );
        dnSeed.x += floor( vDissWorld.y * 5.0 + vDissWorld.x * 2.0 ) * 0.37;
        float dn = dsshash( dnSeed );
        if ( dn < uDissolve ) discard;
        if ( dn < uDissolve + 0.14 ) gl_FragColor.rgb += uEdgeColor * ( 1.0 - uDissolve ) * 2.5;
        #include <dithering_fragment>`);
    material.userData.dissolveUniform = uDissolve;
  };
  const entry = { material, uDissolve };
  dissolvables.push(entry);
  return entry;
}
export function releaseDissolvable(entry) {
  entry.uDissolve.value = 0;
  const i = dissolvables.indexOf(entry);
  if (i >= 0) dissolvables.splice(i, 1);
}

/* floating value popups */
class FloatTextPool {
  constructor(scene, size = 16) {
    this.items = [];
    for (let i = 0; i < size; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 90;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      sprite.visible = false; sprite.scale.set(1.9, 1.07, 1);
      scene.add(sprite);
      this.items.push({ sprite, canvas, tex, ctx: canvas.getContext('2d'), life: 0, vel: new THREE.Vector3() });
    }
  }
  spawn(pos, text, color, big = false) {
    const it = this.items.find(x => x.life <= 0) || this.items[0];
    const { ctx, canvas } = it;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `700 ${big ? 58 : 44}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 80, 48);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(text, 80, 48);
    it.tex.needsUpdate = true;
    it.sprite.position.copy(pos);
    it.sprite.material.opacity = 1;
    it.sprite.scale.set(big ? 2.6 : 1.9, big ? 1.47 : 1.07, 1);
    it.vel.set((Math.random() - 0.5) * 0.6, 2.2 + Math.random(), 0);
    it.life = 1;
    it.sprite.visible = true;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt * 1.1;
      it.sprite.position.addScaledVector(it.vel, dt);
      it.vel.y *= 0.92;
      it.sprite.material.opacity = Math.max(0, it.life) ** 0.7;
      if (it.life <= 0) it.sprite.visible = false;
    }
  }
}

/* particle field */
const PARTICLE_VS = `
attribute float aSize; attribute vec3 aColor; attribute float aLife;
varying vec3 vColor; varying float vLife;
void main() {
  vColor = aColor; vLife = aLife;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_PointSize = aSize * ( 140.0 / -mv.z ) * ( 0.35 + 0.65 * vLife );
  gl_Position = projectionMatrix * mv;
}`;
const PARTICLE_FS = `
varying vec3 vColor; varying float vLife;
void main() {
  float d = length( gl_PointCoord - 0.5 );
  if ( d > 0.5 ) discard;
  float a = ( 1.0 - d * 2.0 ) * smoothstep( 0.0, 0.18, vLife );
  gl_FragColor = vec4( vColor * ( 1.5 + vLife ), a );
}`;

class Particles {
  constructor(scene, max = 1600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);      // remaining seconds
    this.dur = new Float32Array(max);       // total duration
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(pos, vel, color, { size = 6, dur = 0.7, drag = 2, grav = 0 } = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([pos.x, pos.y, pos.z], i * 3);
    this.vel.set([vel.x, vel.y, vel.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = dur; this.dur[i] = dur;
    this.drag[i] = drag; this.grav[i] = grav;
  }
  burst(pos, color, n = 24, opts = {}) {
    for (let i = 0; i < n; i++) {
      const dir = V3.set(Math.random() - 0.5, Math.random() * 0.7 + 0.15, Math.random() - 0.5)
        .normalize().multiplyScalar(2 + Math.random() * 6);
      this.spawn(pos, dir, color, opts);
    }
  }
  update(dt) {
    const { pos, vel, life, drag, grav, dur } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const k = i * 3;
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[k] *= d; vel[k + 1] = vel[k + 1] * d - grav[i] * dt; vel[k + 2] *= d;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    // aLife normalized 0..1 for the shader
    const attr = this.geo.attributes.aLife;
    const arr = attr.array;
    for (let i = 0; i < this.max; i++) arr[i] = Math.max(0, life[i] / Math.max(0.0001, dur[i]));
    attr.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

/* shockwave rings */
class Rings {
  constructor(scene, max = 12) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.86, 1, 48);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7df9ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2; m.visible = false;
      scene.add(m);
      this.items.push({ m, life: 0, maxR: 1 });
    }
  }
  spawn(pos, color, maxR = 4, life = 0.5) {
    const it = this.items.find(x => x.life <= 0) || this.items[0];
    it.m.material.color.set(color);
    it.m.position.copy(pos); it.m.position.y += 0.05;
    it.m.visible = true; it.life = 1; it.maxR = maxR; it.dur = life; it.t = life;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt / it.dur;
      const k = 1 - it.life;
      const r = 0.3 + k * it.maxR;
      it.m.scale.set(r, r, 1);
      it.m.material.opacity = Math.max(0, it.life) * 0.9;
      if (it.life <= 0) it.m.visible = false;
    }
  }
}

/* beams (sentinel charge, boss volley) */
class Beams {
  constructor(scene, max = 8) {
    this.items = [];
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff5f6d, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; scene.add(m);
      this.items.push({ m, life: 0 });
    }
  }
  fire(from, to, color, life = 0.25, width = 1) {
    const it = this.items.find(x => x.life <= 0) || this.items[0];
    const dir = V3.subVectors(to, from);
    const len = dir.length();
    it.m.position.copy(from).addScaledVector(dir, 0.5);
    it.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    it.m.scale.set(width, len, width);
    it.m.material.color.set(color);
    it.m.material.opacity = 1;
    it.m.visible = true; it.life = life; it.dur = life;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      it.m.material.opacity = Math.max(0, it.life / it.dur);
      if (it.life <= 0) it.m.visible = false;
    }
  }
}

/* homing projectiles */
class Projectiles {
  constructor(scene, vfx, max = 24) {
    this.vfx = vfx;
    this.items = [];
    const geo = new THREE.SphereGeometry(0.14, 10, 10);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xbffbff });
      const core = new THREE.Mesh(geo, mat);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: vfx.dotTex, color: 0x7df9ff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(1.6, 1.6, 1);
      core.add(glow);
      core.visible = false; scene.add(core);
      this.items.push({ m: core, vel: new THREE.Vector3(), life: 0, target: null, onHit: null, radius: 0.9 });
    }
  }
  fire(from, target, onHit, color = 0x7df9ff, speed = 40) {
    const it = this.items.find(x => x.life <= 0) || this.items[0];
    it.m.position.copy(from);
    it.m.material.color.set(color);
    it.m.children[0].material.color.set(color);
    it.target = target; it.onHit = onHit; it.speed = speed;
    it.life = 4; it.radius = target?.radius ?? 0.9;
    it.m.visible = true;
    V3.subVectors(target ? target.aimPoint() : V3B.set(0, 2, 0), from).normalize().multiplyScalar(speed);
    it.vel.copy(V3);
    this.vfx.particles.spawn(from, V3.set(0, 0.5, 0), new THREE.Color(color), { size: 9, dur: 0.3 });
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.target && it.target.alive) {
        V3.subVectors(it.target.aimPoint(), it.m.position).normalize().multiplyScalar(it.speed);
        it.vel.lerp(V3, Math.min(1, dt * 14));
      }
      it.m.position.addScaledVector(it.vel, dt);
      it.m.scale.setScalar(0.9 + 0.3 * Math.sin(performance.now() * 0.02));
      // trail
      this.vfx.particles.spawn(it.m.position, V3.set(0, 0, 0),
        new THREE.Color(it.m.material.color), { size: 5, dur: 0.35, drag: 4 });
      if (it.target && it.target.alive) {
        V3.subVectors(it.target.aimPoint(), it.m.position);
        if (V3.length() < it.radius + 0.35) {
          it.life = 0; it.m.visible = false;
          it.onHit && it.onHit(it.target);
          continue;
        }
      }
      if (it.life <= 0) it.m.visible = false;
    }
  }
}

/* =================================================================== */

export class Vfx {
  constructor(scene) {
    this.scene = scene;
    this.dotTex = makeDotTexture();
    this.particles = new Particles(scene);
    this.rings = new Rings(scene);
    this.beams = new Beams(scene);
    this.floats = new FloatTextPool(scene);
    this.projectiles = new Projectiles(scene, this);

    this.trauma = 0;
    this.hitStopT = 0;
    this.slowFactor = 1;          // set by game during nova / death
    this._shakeVec = new THREE.Vector3();
  }

  addTrauma(x) { this.trauma = Math.min(1, this.trauma + x); }
  hitStop(dur = 0.09) { this.hitStopT = Math.max(this.hitStopT, dur); }

  /* effective dt multiplier for gameplay */
  timeScale() {
    if (this.hitStopT > 0) return 0.08;
    if (this.slowFactor < 1) return this.slowFactor;
    return 1;
  }

  killBurst(pos, color) {
    this.particles.burst(pos, color, 30, { size: 7, dur: 0.8, drag: 1.6 });
    this.rings.spawn(pos, color, 2.6, 0.4);
    this.addTrauma(0.32);
    this.hitStop(0.07);
  }
  spawnRing(pos, color, maxR = 4, life = 0.5) { this.rings.spawn(pos, color, maxR, life); }
  beam(from, to, color, life = 0.25, width = 1) { this.beams.fire(from, to, color, life, width); }
  float(pos, text, cssColor, big = false) {
    this.floats.spawn(pos, text, cssColor, big);
  }

  fireProjectile(from, target, onHit, color) {
    this.projectiles.fire(from, target, onHit, color);
  }

  update(dt, camera) {
    this.particles.update(dt);
    this.rings.update(dt);
    this.beams.update(dt);
    this.floats.update(dt);
    this.projectiles.update(dt);

    if (this.hitStopT > 0) this.hitStopT -= dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    if (camera && this.trauma > 0.001) {
      const t = performance.now() * 0.001;
      const s = this.trauma * this.trauma * 0.55;
      this._shakeVec.set(
        (Math.sin(t * 96) + Math.sin(t * 57)) * 0.5 * s,
        (Math.cos(t * 81) + Math.sin(t * 43)) * 0.5 * s,
        0);
      camera.position.add(this._shakeVec);
    }
  }
}
