/* ============================================================
   World — renderer, PBR env lighting, camera rig, the arena:
   polished obsidian ring, rune circles, broken pillars, floating
   rocks, nebula sky shader, dust motes, bloom post-processing.
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const ARENA_R = 14.2;

/* ---------------- nebula sky ---------------- */
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform float uTime;
      float hash( vec2 p ){ return fract( 43758.5453 * sin( dot( p, vec2( 12.9898, 78.233 ) ) ) ); }
      float vnoise( vec2 p ) {
        vec2 i = floor( p ), f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ),
                    mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
      }
      void main() {
        vec3 dir = normalize( vPos );
        vec2 uv = vec2( atan( dir.z, dir.x ) * 1.6, dir.y * 1.4 ) + uTime * 0.02;
        float n = 0.0;
        float a = 0.5;
        for ( int i = 0; i < 4; i ++ ) {
          n += vnoise( uv * 1.7 + float( i ) ) * a;
          a *= 0.5; uv *= 2.1;
        }
        vec3 deep = vec3( 0.004, 0.003, 0.012 );
        vec3 violet = vec3( 0.012, 0.007, 0.035 );
        vec3 cyan = vec3( 0.005, 0.025, 0.04 );
        vec3 col = deep + violet * pow( n, 3.0 ) * 1.1 + cyan * pow( max( n - 0.45, 0.0 ), 2.0 );
        // horizon glow
        float h = 1.0 - abs( dir.y );
        col += vec3( 0.01, 0.006, 0.03 ) * pow( h, 6.0 );
        // stars
        vec3 sp = floor( dir * 220.0 );
        float star = step( 0.9955, hash( sp.xy + sp.z * 0.37 ) );
        col += vec3( 0.8, 0.9, 1.0 ) * star * ( 0.5 + 0.5 * sin( uTime * 2.0 + hash( sp.yz ) * 40.0 ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 20), mat);
  return { sky, mat };
}

/* ---------------- PBR environment map ---------------- */
function buildEnvScene() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(20, 16, 12),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide,
      color: new THREE.Color(0x0b0822) })));
  const addPanel = (color, intensity, pos, rot, size = [8, 3]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  addPanel(0x7df9ff, 6, [0, 9, 0], 0, [14, 4]);      // cyan key above
  addPanel(0xa085ff, 4, [10, 4, 6], 0);              // violet side
  addPanel(0xffc46b, 2, [-10, 2, -6], 0);            // amber counter
  addPanel(0x1a1442, 1, [0, -8, 0], 0);              // dim floor bounce
  return env;
}

/* =================================================================== */

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0820, 0.016);
    this.scene.background = new THREE.Color(0x070513);

    /* env lighting for PBR */
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(buildEnvScene(), 0.05);
    this.scene.environment = envRT.texture;
    pmrem.dispose();

    /* camera rig */
    this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
    this.rig = new THREE.Group();
    this.camera.position.set(0, 9.6, 12.4);
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.lookAt = new THREE.Vector3(0, 1.4, 0);
    this.fovBase = 55;
    this.fovKick = 0;

    /* post-processing — LDR composer target (broadest device support,
       incl. software GL backends where half-float targets fail) */
    this.composer = new EffectComposer(this.renderer,
      new THREE.WebGLRenderTarget(container.clientWidth || 1, container.clientHeight || 1,
        { type: THREE.UnsignedByteType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight), 0.45, 0.5, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    /* 8-bit LDR target quantizes smooth gradients into visible bands —
       break the steps with a tiny display-space dither written to screen */
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        float dhash( vec2 p ){ return fract( 43758.5453 * sin( dot( p, vec2( 12.9898, 78.233 ) ) ) ); }
        void main() {
          vec4 c = texture2D( tDiffuse, vUv );
          c.rgb += ( dhash( gl_FragCoord.xy * 0.0173 + 3.3 ) - 0.5 ) * ( 2.4 / 255.0 );
          gl_FragColor = c;
        }`,
    }));

    this._buildLights();
    this._buildArena();
    this.sky = buildSky(); this.scene.add(this.sky.sky);
    this._buildRocks();
    this._buildDust();

    this._time = 0;
    this._runeLevel = 0;
  }

  /* ---------------- lights ---------------- */
  _buildLights() {
    const dir = new THREE.DirectionalLight(0xbfd4ff, 1.6);
    dir.position.set(7, 16, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -17; dir.shadow.camera.right = 17;
    dir.shadow.camera.top = 17; dir.shadow.camera.bottom = -17;
    dir.shadow.camera.near = 2; dir.shadow.camera.far = 45;
    dir.shadow.bias = -0.0006;
    this.scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x8a8bff, 0x12081a, 0.55);
    this.scene.add(hemi);

    const rim = new THREE.DirectionalLight(0xff9f6b, 0.35);
    rim.position.set(-8, 5, -10);
    this.scene.add(rim);
  }

  /* ---------------- the arena ---------------- */
  _buildArena() {
    const S = this.scene;
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x17132e, metalness: 0.88, roughness: 0.34,
      envMapIntensity: 1.25,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R, 72), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    S.add(floor);

    /* rim glow beneath the disc */
    const rimGlow = new THREE.Mesh(
      new THREE.RingGeometry(ARENA_R - 0.15, ARENA_R + 0.7, 72),
      new THREE.MeshBasicMaterial({ color: 0xa085ff, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    rimGlow.rotation.x = -Math.PI / 2; rimGlow.position.y = -0.22;
    S.add(rimGlow);

    /* rune circle — pulses with tier */
    this.runeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 0.86, 128),
      new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    this.runeRing.rotation.x = -Math.PI / 2;
    this.runeRing.position.y = 0.03;
    this.runeRing.scale.setScalar(11);
    S.add(this.runeRing);

    const ring2 = this.runeRing.clone();
    ring2.material = this.runeRing.material.clone();
    ring2.material.opacity = 0.22;
    ring2.scale.setScalar(6.2);
    S.add(ring2);
    this.runeRing2 = ring2;

    /* grooves */
    for (const r of [9.5, 12.4]) {
      const groove = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.05, 6, 96),
        new THREE.MeshStandardMaterial({ color: 0x0d0b1e, metalness: 0.9, roughness: 0.5 }));
      groove.rotation.x = Math.PI / 2; groove.position.y = 0.02;
      S.add(groove);
    }

    /* center dais */
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.6, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0x1d1840, metalness: 0.85, roughness: 0.4,
        envMapIntensity: 1.3 }));
    dais.position.y = 0.07; dais.receiveShadow = true;
    S.add(dais);

    /* broken pillars */
    const stone = new THREE.MeshStandardMaterial({ color: 0x211c3f, metalness: 0.55, roughness: 0.62 });
    const pillarGeoX = new THREE.BoxGeometry(1.0, 4.6, 1.0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const p = new THREE.Mesh(pillarGeoX, stone);
      const r = ARENA_R + 3.2;
      p.position.set(Math.cos(a) * r, 2.1, Math.sin(a) * r);
      p.rotation.y = a; p.castShadow = true;
      S.add(p);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 3.4),
        new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.65,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      strip.position.set(Math.cos(a) * (r - 0.52), 2.0, Math.sin(a) * (r - 0.52));
      strip.rotation.y = a + Math.PI / 2;
      strip.renderOrder = 998;
      S.add(strip);
    }

    /* rune circle pulse baseline */
    this.runePulse = 0;
  }

  /* ---------------- floating rocks ---------------- */
  _buildRocks() {
    this.rocks = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x141126, metalness: 0.4, roughness: 0.8 });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.6 + Math.random() * 2.2, 0), mat);
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 12;
      m.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 9, Math.sin(a) * r);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      this.rocks.push({ m, a, r, speed: 0.02 + Math.random() * 0.03, bob: Math.random() * 6 });
    }
  }

  /* ---------------- dust motes ---------------- */
  _buildDust() {
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fb4ff, size: 0.09, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ---------------- runtime ---------------- */
  setRuneLevel(level) { this._runeLevel = level; }   // 0..4 by tier

  fovKickStart() { this.fovKick = 1; }

  update(dt, heroPos) {
    this._time += dt;

    /* sky + rune pulse */
    this.sky.mat.uniforms.uTime.value = this._time;
    const lv = this._runeLevel;
    const pulse = 0.45 + 0.25 * Math.sin(this._time * (1.4 + lv * 0.6));
    this.runeRing.material.opacity = pulse * (0.5 + lv * 0.16);
    this.runeRing.rotation.z = this._time * 0.05 * (1 + lv);
    this.runeRing2.material.opacity = 0.22 * (1 + 0.4 * Math.sin(this._time * 0.8));
    this.runeRing2.rotation.z = -this._time * 0.04;

    /* rocks drift */
    for (const rk of this.rocks) {
      rk.a += rk.speed * dt;
      rk.m.position.x = Math.cos(rk.a) * rk.r;
      rk.m.position.z = Math.sin(rk.a) * rk.r;
      rk.m.position.y += Math.sin(this._time * 0.4 + rk.bob) * dt * 0.2;
      rk.m.rotation.y += dt * 0.1;
    }

    /* dust drift up */
    const pos = this.dust.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += dt * 0.25;
      if (arr[i + 1] > 14) arr[i + 1] = 0;
    }
    pos.needsUpdate = true;

    /* camera follow */
    const target = this.rig.position;
    target.lerp(heroPos ? new THREE.Vector3(heroPos.x * 0.35, 0, heroPos.z * 0.35 + 2.5) : target, Math.min(1, dt * 3));

    this.fovKick = Math.max(0, this.fovKick - dt * 3);
    const fov = this.fovBase + this.fovKick * 7;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }

    /* vfx shake applied by caller onto camera.position; recompute base each frame */
    this.camera.position.set(0, 9.6, 12.4);
    this.camera.lookAt(this.lookAt);
  }

  render() {
    this.composer.render();
  }

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
