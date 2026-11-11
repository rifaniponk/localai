/* Math Survivor 2 — fresh procedural Three.js assets, PBR materials, zero external files.
 * Character: Kestrel, an armored signal scout with a glowing spear.
 * Environment: a five-stage aurora outpost with physically based stone, metal, and glass.
 */
import * as THREE from "./vendor/three.module.js";

export const AF = {
  // ---------- helpers ----------
  pbr(hex, roughness = 0.55, metalness = 0.35, clearcoat = 0.25) {
    return new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.0
    });
  },
  glowPbr(hex, emissive, intensity = 1.4, roughness = 0.25) {
    return new THREE.MeshPhysicalMaterial({
      color: hex,
      emissive,
      emissiveIntensity: intensity,
      roughness,
      metalness: 0.15,
      clearcoat: 0.45,
      envMapIntensity: 1.0
    });
  },

  // ---------- procedural textures ----------
  envTex() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#0a1020");
    g.addColorStop(0.32, "#14253b");
    g.addColorStop(0.52, "#244a66");
    g.addColorStop(0.68, "#2d5f74");
    g.addColorStop(0.82, "#13202c");
    g.addColorStop(1, "#07090e");
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);

    for (let i = 0; i < 5; i++) {
      const band = x.createLinearGradient(0, 100 + i * 42, 1024, 70 + i * 38);
      band.addColorStop(0, "rgba(80,210,255,0)");
      band.addColorStop(0.35, "rgba(100,235,255,0.22)");
      band.addColorStop(0.7, "rgba(190,140,255,0.14)");
      band.addColorStop(1, "rgba(80,210,255,0)");
      x.fillStyle = band;
      x.fillRect(0, 100 + i * 42, 1024, 20);
    }

    const warm = x.createRadialGradient(512, 470, 20, 512, 470, 330);
    warm.addColorStop(0, "rgba(255,190,120,0.32)");
    warm.addColorStop(0.55, "rgba(255,150,80,0.10)");
    warm.addColorStop(1, "rgba(255,150,80,0)");
    x.fillStyle = warm;
    x.fillRect(0, 300, 1024, 212);

    for (let i = 0; i < 70; i++) {
      x.fillStyle = "rgba(230,250,255," + (0.2 + Math.random() * 0.5) + ")";
      x.fillRect(Math.random() * 1024, Math.random() * 220, 1.5, 1.5);
    }

    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  floorTex(base, line) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d");
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1800; i++) {
      x.fillStyle = "rgba(255,255,255," + (Math.random() * 0.035) + ")";
      x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    x.strokeStyle = line;
    x.lineWidth = 2;
    for (let g = 0; g <= 8; g++) {
      x.beginPath();
      x.moveTo(g * 64, 0);
      x.lineTo(g * 64, 512);
      x.stroke();
      x.beginPath();
      x.moveTo(0, g * 64);
      x.lineTo(512, g * 64);
      x.stroke();
    }

    for (let gx = 0; gx < 8; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        if ((gx + gy) % 2 === 0) {
          x.fillStyle = "rgba(255,255,255,0.025)";
          x.fillRect(gx * 64 + 4, gy * 64 + 4, 56, 56);
        }
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  glowTex(inner, outer) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, inner);
    g.addColorStop(0.55, outer);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  },
  runeTex(color) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.translate(128, 128);
    x.strokeStyle = color;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(0, 0, 110, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.arc(0, 0, 92, 0, Math.PI * 2);
    x.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
      x.lineTo(Math.cos(a) * 110, Math.sin(a) * 110);
      x.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const b = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
      x.lineTo(Math.cos(b) * 60, Math.sin(b) * 60);
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  },
  portalTex(inner) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 8, 128, 128, 124);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.32, inner);
    g.addColorStop(0.72, inner.replace(/[\d.]+\)$/, "0.2)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,255,255,0.35)";
    x.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.arc(128, 128, 28 + i * 18, i * 1.3, i * 1.3 + 2.2);
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  },

  // ---------- biome palettes ----------
  BIOME_PALS: [
    { stone: 0x35465c, stoneDark: 0x161d2a, deco: 0x5f7192, glow: 0x7ad8ff, flame: 0xff9a5c, portal: "rgba(122,216,255,0.9)" },
    { stone: 0x2b3145, stoneDark: 0x10141f, deco: 0x8a7356, glow: 0xffd35c, flame: 0xffb45c, portal: "rgba(255,211,92,0.9)" },
    { stone: 0x3d2c2d, stoneDark: 0x1f1416, deco: 0x8a5a4a, glow: 0xff6a4a, flame: 0xff6a3a, portal: "rgba(255,90,70,0.9)" },
    { stone: 0x263d4d, stoneDark: 0x12222d, deco: 0x6f8fa0, glow: 0x7ad8ff, flame: 0x9fe8ff, portal: "rgba(122,216,255,0.9)" },
    { stone: 0x2c2744, stoneDark: 0x171329, deco: 0x6a5a8a, glow: 0xc9a2ff, flame: 0xff8a5c, portal: "rgba(201,162,255,0.9)" }
  ],

  buildBiome(i) {
    const P = AF.BIOME_PALS[i % AF.BIOME_PALS.length];
    const g = new THREE.Group();
    const torchLights = [];

    const stone = AF.pbr(P.stone, 0.72, 0.22, 0.18);
    const dark = AF.pbr(P.stoneDark, 0.85, 0.12, 0.1);
    const deco = AF.pbr(P.deco, 0.42, 0.62, 0.4);
    const glow = AF.glowPbr(P.glow, P.glow, 1.5, 0.22);
    const flameM = AF.glowPbr(0xffd35c, P.flame, 2.4, 0.25);

    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

    for (const sx of [-1, 1]) {
      const wall = box(1.4, 5.2, 26, stone);
      wall.position.set(sx * 7.3, 2.6, -1);
      g.add(wall);

      const ledge = box(0.7, 0.5, 26, deco);
      ledge.position.set(sx * 6.45, 5.2, -1);
      g.add(ledge);

      const cliff = box(3.2, 9, 30, dark);
      cliff.position.set(sx * 9.6, 4.2, -2);
      g.add(cliff);
    }

    const bwL = box(4.6, 7, 1.4, stone);
    bwL.position.set(-5.1, 3.5, -11.6);
    g.add(bwL);

    const bwR = box(4.6, 7, 1.4, stone);
    bwR.position.set(5.1, 3.5, -11.6);
    g.add(bwR);

    const bwTop = box(14.4, 2.4, 1.4, stone);
    bwTop.position.set(0, 8.2, -11.6);
    g.add(bwTop);

    for (const sx of [-1, 1]) {
      const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 6.4, 10), deco);
      ap.position.set(sx * 2.9, 3.2, -11.4);
      g.add(ap);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 8, 20), glow);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(sx * 2.9, 5.8, -11.4);
      g.add(collar);
    }

    const keyStone = box(1.2, 1.0, 1.6, deco);
    keyStone.position.set(0, 6.8, -11.4);
    g.add(keyStone);

    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({
        map: AF.portalTex(P.portal),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    portal.position.set(0, 3.0, -11.9);
    g.add(portal);

    for (let k = 0; k < 5; k++) {
      const h = 5 + (k % 3) * 3;
      const b = box(6, h, 2, dark);
      b.position.set(-10 + k * 5, h / 2 - 0.5, -17 - (k % 2) * 3);
      b.rotation.y = (k - 2) * 0.12;
      g.add(b);
    }

    const laneTex = AF.glowTex("rgba(160,210,255,0.55)", "rgba(120,160,220,0.12)");
    for (const lx of [-6, -3.6, -1.2, 1.2, 3.6, 6]) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 21),
        new THREE.MeshBasicMaterial({
          map: laneTex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      s.rotation.x = -Math.PI / 2;
      s.position.set(lx, 0.018, -1);
      g.add(s);
    }

    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.16, 6), deco);
    plat.position.set(0, 0.08, 5.2);
    g.add(plat);

    const platRim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 8, 6), glow);
    platRim.rotation.x = Math.PI / 2;
    platRim.rotation.z = Math.PI / 6;
    platRim.position.set(0, 0.17, 5.2);
    g.add(platRim);

    const brazier = (x, z, tall) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, tall, 6), deco);
      pole.position.set(x, tall / 2, z);
      g.add(pole);

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.3, 8), deco);
      bowl.position.set(x, tall + 0.1, z);
      g.add(bowl);

      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), flameM);
      flame.position.set(x, tall + 0.34, z);
      flame.scale.y = 1.3;
      g.add(flame);

      const light = new THREE.PointLight(P.flame, 1.1, 9);
      light.position.set(x, tall + 0.5, z);
      g.add(light);

      torchLights.push({ flame, light, phase: Math.random() * 6.28 });
    };

    if (i % 5 === 0) {
      const pylon = (x, z, h) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 8), deco);
        p.position.set(x, h / 2, z);
        g.add(p);

        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glow);
        tip.position.set(x, h + 0.1, z);
        g.add(tip);
      };
      pylon(-6.2, -6.5, 3.8);
      pylon(6.2, -2.5, 3.1);
      pylon(-6.1, 2.0, 2.7);
      pylon(6.1, 4.4, 3.6);

      for (const sx of [-1, 1]) {
        const dish = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 22), deco);
        dish.rotation.x = 1.1;
        dish.position.set(sx * 6.2, 3.4, -7.5);
        g.add(dish);

        const dishCore = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glow);
        dishCore.position.set(sx * 6.2, 3.4, -7.5);
        g.add(dishCore);
      }
      brazier(-6.2, -9, 1.5);
      brazier(6.2, -9, 1.5);
    } else if (i % 5 === 1) {
      const shard = (x, z, h, tilt) => {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.34, h, 5), AF.pbr(P.deco, 0.22, 0.7, 0.55));
        s.position.set(x, h / 2, z);
        s.rotation.z = tilt;
        g.add(s);
      };
      shard(-6.4, -7.5, 2.8, 0.15);
      shard(6.4, -5.0, 3.4, -0.12);
      shard(-6.3, 1.0, 2.2, 0.2);
      shard(6.4, 4.5, 2.6, -0.18);
      shard(-5.6, -10.5, 1.6, 0.3);
      shard(5.6, -10.5, 1.8, -0.3);
      brazier(-6.2, -9, 1.5);
      brazier(6.2, -9, 1.5);
    } else if (i % 5 === 2) {
      const crackM = AF.glowPbr(0xff6a4a, 0xff4a2a, 1.8, 0.3);
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + Math.random() * 0.4, 3 + Math.random() * 3), crackM);
        c.rotation.x = -Math.PI / 2;
        c.rotation.z = Math.random() * 0.6 - 0.3;
        c.position.set((k % 2 ? 1 : -1) * (5.4 + Math.random() * 0.8), 0.025, -8 + k * 3.5);
        g.add(c);
      }
      brazier(-6.2, -9, 1.4);
      brazier(6.2, -9, 1.4);
      brazier(-6.4, 4, 1.2);
      brazier(6.4, 4, 1.2);
    } else if (i % 5 === 3) {
      const iceM = new THREE.MeshPhysicalMaterial({
        color: 0xbfe8ff,
        roughness: 0.08,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transmission: 0.45,
        transparent: true,
        opacity: 0.78,
        envMapIntensity: 1.4
      });
      const shard = (x, z, h, tilt) => {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.3, h, 5), iceM);
        s.position.set(x, h / 2, z);
        s.rotation.z = tilt;
        g.add(s);
      };
      shard(-6.4, -7.5, 2.8, 0.15);
      shard(6.4, -5, 3.4, -0.12);
      shard(-6.3, 1, 2.2, 0.2);
      shard(6.4, 4.5, 2.6, -0.18);
      shard(-5.6, -10.5, 1.6, 0.3);
      shard(5.6, -10.5, 1.8, -0.3);
      for (const sx of [-1, 1]) {
        const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 7), stone);
        fp.position.set(sx * 6.6, 2.1, -3 + sx);
        g.add(fp);
      }
      brazier(-6.2, -9, 1.5);
      brazier(6.2, -9, 1.5);
    } else {
      const rings = [];
      const floaters = [];
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 + k * 0.5, 0.05, 8, 28), glow);
        r.position.set(0, 3.4 + k * 0.5, -11.2);
        r.rotation.x = 1.2 + k * 0.3;
        g.add(r);
        rings.push(r);
      }
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), glow);
        c.position.set((k % 2 ? 1 : -1) * (5.8 + Math.random()), 2.4 + Math.random() * 2, -9 + k * 2.6);
        g.add(c);
        floaters.push(c);
      }
      g.userData.floaters = floaters;
      g.userData.rings = rings;
      brazier(-6.2, -9.5, 1.3);
      brazier(6.2, -9.5, 1.3);
    }

    return { group: g, torchLights };
  },
  disposeBiome(b) {
    b.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  },

  // ---------- elite crown ----------
  eliteDeco(color) {
    const g = new THREE.Group();
    const m = AF.glowPbr(0xffd35c, color, 2.0, 0.25);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), m);
    band.rotation.x = Math.PI / 2;
    g.add(band);

    const spikeGeo = new THREE.ConeGeometry(0.07, 0.26, 6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const sp = new THREE.Mesh(spikeGeo, m);
      sp.position.set(Math.cos(a) * 0.24, 0.14, Math.sin(a) * 0.24);
      sp.rotation.z = -Math.cos(a) * 0.4;
      sp.rotation.x = Math.sin(a) * 0.4;
      g.add(sp);
    }

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), m);
    gem.position.y = 0.26;
    g.add(gem);
    return g;
  },

  // ---------- shared face bits ----------
  eyes(mat, dx, y, z, r) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(r || 0.09, 10, 10);
    const l = new THREE.Mesh(geo, mat);
    l.position.set(-dx, y, z);
    const rr = new THREE.Mesh(geo, mat);
    rr.position.set(dx, y, z);
    g.add(l, rr);
    return g;
  },
  faceEyes(sclera, pupil, dx, y, z, r, browColor) {
    const g = new THREE.Group();
    const sGeo = new THREE.SphereGeometry(r, 10, 10);
    const pGeo = new THREE.SphereGeometry(r * 0.55, 8, 8);
    const bGeo = new THREE.BoxGeometry(r * 2.4, r * 0.5, r * 0.6);
    const bm = AF.pbr(browColor || 0x14182a, 0.55, 0.2, 0.1);
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: sclera }));
      s.position.set(sx * dx, y, z);
      const p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: pupil }));
      p.position.set(sx * dx, y, z + r * 0.62);
      const b = new THREE.Mesh(bGeo, bm);
      b.position.set(sx * dx, y + r * 1.35, z + r * 0.3);
      b.rotation.z = sx * 0.35;
      g.add(s, p, b);
    }
    return g;
  },
  mouth(color, x, y, z, w, h) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color }));
    m.scale.set(w || 0.16, h || 0.05, 0.05);
    m.position.set(x, y, z);
    return m;
  },
  blobShadow() {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshBasicMaterial({
        map: AF.glowTex("rgba(0,0,0,0.5)", "rgba(0,0,0,0.25)"),
        transparent: true,
        depthWrite: false
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    return m;
  },

  // ---------- fresh hero: Kestrel, armored signal scout ----------
  hero() {
    const g = new THREE.Group();

    const armor = AF.pbr(0x2d6f7a, 0.35, 0.65, 0.4);
    const armorDark = AF.pbr(0x16343b, 0.45, 0.55, 0.3);
    const gold = AF.pbr(0xd79a3b, 0.26, 0.9, 0.5);
    const fabric = AF.pbr(0x1a2936, 0.85, 0.05, 0.0);
    const skin = AF.pbr(0xd9a477, 0.72, 0.0, 0.0);
    const visorM = new THREE.MeshPhysicalMaterial({
      color: 0x0c2230,
      roughness: 0.14,
      metalness: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: 0x2fd8ff,
      emissiveIntensity: 0.55
    });
    const glowM = AF.glowPbr(0x9ff6ff, 0x2fd8ff, 2.2, 0.18);

    const bootGeo = new THREE.CapsuleGeometry(0.12, 0.18, 4, 8);
    const bootL = new THREE.Mesh(bootGeo, armorDark);
    bootL.position.set(-0.16, 0.12, 0.22);
    bootL.rotation.x = Math.PI / 2;
    const bootR = new THREE.Mesh(bootGeo, armorDark);
    bootR.position.set(0.16, 0.12, 0.22);
    bootR.rotation.x = Math.PI / 2;

    const legGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 8);
    const legL = new THREE.Mesh(legGeo, armorDark);
    legL.position.set(-0.15, 0.44, 0.0);
    const legR = new THREE.Mesh(legGeo, armorDark);
    legR.position.set(0.15, 0.44, 0.0);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.55, 0.72, 10), armorDark);
    skirt.position.y = 0.66;

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 6, 12), armor);
    torso.position.y = 1.08;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.25, 0.16), armorDark);
    chest.position.set(0, 1.15, 0.25);
    chest.rotation.x = 0.08;

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 18), gold);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.9;

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), glowM);
    buckle.position.set(0, 0.9, 0.31);

    const padGeo = new THREE.SphereGeometry(0.19, 12, 10);
    const padL = new THREE.Mesh(padGeo, gold);
    padL.position.set(-0.39, 1.24, 0.02);
    padL.scale.set(1.0, 0.75, 0.85);
    const padR = new THREE.Mesh(padGeo, gold);
    padR.position.set(0.39, 1.24, 0.02);
    padR.scale.set(1.0, 0.75, 0.85);

    const armGeo = new THREE.CapsuleGeometry(0.07, 0.34, 4, 8);
    const armL = new THREE.Mesh(armGeo, armor);
    armL.position.set(-0.38, 1.0, 0.05);
    armL.rotation.z = 0.5;
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
    handL.position.set(-0.55, 0.82, 0.08);

    const armR = new THREE.Mesh(armGeo, armor);
    armR.position.set(0.38, 1.05, 0.12);
    armR.rotation.z = -0.75;
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
    handR.position.set(0.55, 0.9, 0.18);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), skin);
    head.position.y = 1.62;

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      armor
    );
    helmet.position.y = 1.62;

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.04, 16), armorDark);
    brim.position.y = 1.62;

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.03), visorM);
    visor.position.set(0, 1.58, 0.26);
    visor.rotation.x = 0.1;

    const face = AF.faceEyes(0xffe9c9, 0x1b1d24, 0.08, 1.58, 0.2, 0.035, 0x26323a);

    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 10, 1, true), fabric);
    cape.position.set(0, 0.9, -0.18);
    cape.rotation.x = 0.12;

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.22), armorDark);
    pack.position.set(0, 1.12, -0.3);

    const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.025), glowM);
    packGlow.position.set(0, 1.12, -0.42);

    const staff = new THREE.Group();

    const metal = AF.pbr(0x4b5c6e, 0.3, 0.8, 0.5);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 8), metal);
    rod.position.y = 0.85;

    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 6), gold);
    blade.position.y = 1.72;

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), glowM);
    orb.position.y = 1.58;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 24), glowM);
    ring.position.y = 1.58;
    ring.rotation.x = 1.1;

    const orbLight = new THREE.PointLight(0x45e0ff, 1.4, 5);
    orbLight.position.y = 1.58;

    staff.add(rod, blade, orb, ring, orbLight);
    staff.position.set(0.62, 0, 0.14);

    g.add(
      bootL, bootR, legL, legR, skirt, torso, chest, belt, buckle,
      padL, padR, armL, handL, armR, handR,
      head, helmet, brim, visor, face, cape, pack, packGlow, staff,
      AF.blobShadow()
    );

    return { group: g, parts: { body: torso, head, staff, orb, ring } };
  },

  // ---------- enemy roster with PBR bodies ----------
  slime(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
      transparent: true,
      opacity: 0.92
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), mat);
    body.scale.y = 0.78;
    body.position.y = 0.5;

    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    drip.position.set(0.18, 0.92, 0.1);
    drip.scale.y = 1.4;

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        clearcoat: 1
      })
    );
    shine.position.set(-0.22, 0.78, 0.35);

    const stub = new THREE.SphereGeometry(0.13, 10, 8);
    const al = new THREE.Mesh(stub, mat);
    al.position.set(-0.58, 0.42, 0.12);
    al.scale.set(1, 0.8, 0.8);
    const ar = new THREE.Mesh(stub, mat);
    ar.position.set(0.58, 0.42, 0.12);
    ar.scale.set(1, 0.8, 0.8);

    const footGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const fl = new THREE.Mesh(footGeo, mat);
    fl.position.set(-0.24, 0.1, 0.28);
    fl.scale.set(1.2, 0.6, 1.4);
    const fr = new THREE.Mesh(footGeo, mat);
    fr.position.set(0.24, 0.1, 0.28);
    fr.scale.set(1.2, 0.6, 1.4);

    const face = AF.faceEyes(0xffffff, 0x10231a, 0.18, 0.62, 0.5, 0.09, color);
    const mouth = AF.mouth(0x10231a, 0, 0.44, 0.55, 0.17, 0.06);

    g.add(body, drip, shine, al, ar, fl, fr, face, mouth, AF.blobShadow());
    return { group: g, parts: { body, al, ar, mouth, face } };
  },

  bat(color) {
    const g = new THREE.Group();
    const mat = AF.pbr(color, 0.5, 0.25, 0.25);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), mat);
    body.position.y = 1.15;
    body.scale.set(0.9, 1.05, 0.9);

    const wingGeo = new THREE.ConeGeometry(0.42, 0.9, 4, 1, true);
    const wm = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      metalness: 0.18,
      clearcoat: 0.3,
      side: THREE.DoubleSide
    });
    const wl = new THREE.Mesh(wingGeo, wm);
    wl.position.set(-0.55, 1.25, 0);
    wl.rotation.z = 1.25;
    wl.scale.z = 0.35;
    const wr = new THREE.Mesh(wingGeo, wm);
    wr.position.set(0.55, 1.25, 0);
    wr.rotation.z = -1.25;
    wr.scale.z = 0.35;

    const boneGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6);
    const bl = new THREE.Mesh(boneGeo, mat);
    bl.position.set(-0.55, 1.25, 0);
    bl.rotation.z = 1.25;
    const br = new THREE.Mesh(boneGeo, mat);
    br.position.set(0.55, 1.25, 0);
    br.rotation.z = -1.25;

    const earGeo = new THREE.ConeGeometry(0.11, 0.3, 8);
    const el = new THREE.Mesh(earGeo, mat);
    el.position.set(-0.2, 1.52, 0);
    el.rotation.z = 0.25;
    const er = new THREE.Mesh(earGeo, mat);
    er.position.set(0.2, 1.52, 0);
    er.rotation.z = -0.25;

    const fangGeo = new THREE.ConeGeometry(0.04, 0.12, 6);
    const fm = AF.pbr(0xffffff, 0.35, 0.1, 0.2);
    const fangL = new THREE.Mesh(fangGeo, fm);
    fangL.position.set(-0.1, 1.0, 0.34);
    fangL.rotation.x = 0.2;
    const fangR = new THREE.Mesh(fangGeo, fm);
    fangR.position.set(0.1, 1.0, 0.34);
    fangR.rotation.x = 0.2;

    const face = AF.faceEyes(0xffe27a, 0x2a0e1e, 0.14, 1.24, 0.33, 0.08, 0x14182a);
    const mouth = AF.mouth(0x2a0e1e, 0, 1.05, 0.37, 0.11, 0.04);

    g.add(body, wl, wr, bl, br, el, er, fangL, fangR, face, mouth, AF.blobShadow());
    return { group: g, parts: { body, wl, wr, hover: 1.15, face, mouth } };
  },

  skeleton(color) {
    const g = new THREE.Group();
    const bm = AF.pbr(0xe8e4d8, 0.45, 0.18, 0.2);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), bm);
    head.position.y = 1.62;

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.2), bm);
    jaw.position.set(0, 1.44, 0.1);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), bm);
    torso.position.y = 0.95;

    const ribGeo = new THREE.TorusGeometry(0.2, 0.028, 6, 14, Math.PI * 1.4);
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(ribGeo, bm);
      rib.position.set(0, 1.12 - i * 0.14, 0.02);
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = Math.PI * 0.8;
      g.add(rib);
    }

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.2), bm);
    pelvis.position.y = 0.62;

    const legGeo = new THREE.CapsuleGeometry(0.06, 0.42, 4, 8);
    const ll = new THREE.Mesh(legGeo, bm);
    ll.position.set(-0.14, 0.32, 0);
    const lr = new THREE.Mesh(legGeo, bm);
    lr.position.set(0.14, 0.32, 0);

    const armGeo = new THREE.CapsuleGeometry(0.055, 0.5, 4, 8);
    const al = new THREE.Mesh(armGeo, bm);
    al.position.set(-0.4, 1.0, 0);
    al.rotation.z = 0.35;
    const ar = new THREE.Mesh(armGeo, bm);
    ar.position.set(0.4, 1.0, 0);
    ar.rotation.z = -0.35;

    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.8, 0.02),
      AF.glowPbr(color, color, 0.8, 0.25)
    );
    sword.position.set(0.52, 1.35, 0.1);
    sword.rotation.z = -0.4;

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), bm);
    guard.position.set(0.46, 1.05, 0.1);
    guard.rotation.z = -0.4;

    const face = AF.faceEyes(0xd94040, 0x3a0a0a, 0.1, 1.66, 0.24, 0.055, 0x8a8676);

    g.add(head, jaw, torso, pelvis, ll, lr, al, ar, sword, guard, face, AF.blobShadow());
    return { group: g, parts: { body: torso, head, al, ar, face } };
  },

  golem(color) {
    const g = new THREE.Group();

    const sm = AF.pbr(color, 0.82, 0.2, 0.15);
    const sm2 = AF.pbr(color, 0.92, 0.12, 0.1);
    sm2.color.multiplyScalar(0.8);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), sm2);
    legs.position.y = 0.3;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.65), sm);
    torso.position.y = 1.0;

    const shGeo = new THREE.DodecahedronGeometry(0.3);
    const shl = new THREE.Mesh(shGeo, sm2);
    shl.position.set(-0.62, 1.35, 0);
    shl.rotation.set(0.4, 0.8, 0.2);
    const shr = new THREE.Mesh(shGeo, sm2);
    shr.position.set(0.62, 1.32, 0.05);
    shr.rotation.set(0.9, 0.2, 0.6);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), sm);
    head.position.y = 1.66;
    head.rotation.y = 0.15;

    const fistGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const fl = new THREE.Mesh(fistGeo, sm2);
    fl.position.set(-0.72, 0.85, 0.15);
    const fr = new THREE.Mesh(fistGeo, sm2);
    fr.position.set(0.72, 0.85, 0.15);

    const crackM = AF.glowPbr(0xff7a3c, 0xff5a1c, 1.8, 0.25);
    const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), crackM);
    crack1.position.set(-0.15, 1.05, 0.34);
    crack1.rotation.z = 0.3;
    const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.03), crackM);
    crack2.position.set(0.2, 0.9, 0.34);
    crack2.rotation.z = -0.5;

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), crackM);
    crystal.position.set(0, 1.05, 0.36);

    const mossM = AF.pbr(0x4a7a3a, 0.9, 0.05, 0.0);
    const moss1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mossM);
    moss1.position.set(-0.3, 1.42, 0.2);
    moss1.scale.y = 0.5;
    const moss2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mossM);
    moss2.position.set(0.35, 0.55, 0.24);
    moss2.scale.y = 0.5;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffa53c });

    g.add(legs, torso, shl, shr, head, fl, fr, crack1, crack2, crystal, moss1, moss2,
      AF.eyes(eyeMat, 0.12, 1.7, 0.24, 0.06), AF.blobShadow());
    return { group: g, parts: { body: torso, head, fl, fr, crystal } };
  },

  ghost(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.75
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat);
    body.position.y = 1.15;

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 12), mat);
    tail.position.y = 0.62;
    tail.rotation.x = Math.PI;

    const armGeo = new THREE.CapsuleGeometry(0.09, 0.3, 4, 8);
    const al = new THREE.Mesh(armGeo, mat);
    al.position.set(-0.5, 1.05, 0.1);
    al.rotation.z = 0.8;
    const ar = new THREE.Mesh(armGeo, mat);
    ar.position.set(0.5, 1.05, 0.1);
    ar.rotation.z = -0.8;

    const crownM = AF.glowPbr(0xffd35c, 0xaa7a10, 0.8, 0.35);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.14, 8, 1, true), crownM);
    crown.position.y = 1.62;

    const spikeGeo = new THREE.ConeGeometry(0.05, 0.12, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sp = new THREE.Mesh(spikeGeo, crownM);
      sp.position.set(Math.cos(a) * 0.14, 1.72, Math.sin(a) * 0.14);
      g.add(sp);
    }

    const face = AF.faceEyes(0xdcecff, 0x18324a, 0.16, 1.25, 0.42, 0.09, 0x3a5a7a);
    const mouth = AF.mouth(0x18324a, 0, 1.05, 0.45, 0.1, 0.07);

    g.add(body, tail, al, ar, crown, face, mouth, AF.blobShadow());
    return { group: g, parts: { body, tail, al, ar, hover: 1.15, face, mouth } };
  },

  bossDragon() {
    const g = new THREE.Group();

    const dm = AF.pbr(0x8e2f6e, 0.42, 0.35, 0.35);
    const wingM = AF.pbr(0x6d2252, 0.65, 0.25, 0.25);
    const gold = AF.pbr(0xffd35c, 0.24, 0.9, 0.55);
    const bellyM = AF.pbr(0xf2c14e, 0.55, 0.25, 0.25);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), dm);
    body.position.y = 1.35;
    body.scale.set(1, 0.9, 1.1);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), dm);
    head.position.set(0, 2.35, 0.55);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), dm);
    snout.position.set(0, 2.2, 1.05);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), dm);
    jaw.position.set(0, 2.02, 1.05);

    const fangGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
    const fm = AF.pbr(0xffffff, 0.35, 0.1, 0.2);
    for (const sx of [-1, 1]) {
      const f1 = new THREE.Mesh(fangGeo, fm);
      f1.position.set(sx * 0.16, 2.12, 1.26);
      f1.rotation.x = Math.PI;
      const f2 = new THREE.Mesh(fangGeo, fm);
      f2.position.set(sx * 0.16, 2.16, 1.26);
      g.add(f1, f2);
    }

    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
    const hl = new THREE.Mesh(hornGeo, gold);
    hl.position.set(-0.3, 2.85, 0.4);
    hl.rotation.z = 0.3;
    const hr = new THREE.Mesh(hornGeo, gold);
    hr.position.set(0.3, 2.85, 0.4);
    hr.rotation.z = -0.3;

    const spikeGeo = new THREE.ConeGeometry(0.11, 0.3, 6);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(spikeGeo, gold);
      sp.position.set(0, 2.1 - i * 0.28, -0.55 - i * 0.32);
      sp.rotation.x = -0.5;
      g.add(sp);
    }

    const tail1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 10), dm);
    tail1.position.set(0, 0.9, -1.15);
    tail1.rotation.x = 1.2;

    const tail2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 4, 10), dm);
    tail2.position.set(0, 0.75, -1.85);
    tail2.rotation.x = 1.45;

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), gold);
    tailTip.position.set(0, 0.7, -2.35);
    tailTip.rotation.x = 1.6;

    const wingGeo = new THREE.ConeGeometry(0.9, 1.9, 4, 1, true);
    const wl = new THREE.Mesh(wingGeo, wingM);
    wl.position.set(-1.35, 1.9, -0.2);
    wl.rotation.z = 1.15;
    wl.scale.z = 0.4;
    const wr = new THREE.Mesh(wingGeo, wingM);
    wr.position.set(1.35, 1.9, -0.2);
    wr.rotation.z = -1.15;
    wr.scale.z = 0.4;

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), bellyM);
    belly.position.set(0, 1.1, 0.55);
    belly.scale.set(0.8, 0.85, 0.5);

    const plateGeo = new THREE.TorusGeometry(0.42, 0.05, 6, 14, Math.PI);
    const plateM = AF.pbr(0xd9a53a, 0.4, 0.6, 0.35);
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(plateGeo, plateM);
      pl.position.set(0, 0.85 + i * 0.28, 0.72);
      pl.rotation.y = Math.PI;
      pl.rotation.x = 0.35;
      g.add(pl);
    }

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24),
      AF.glowPbr(0xff5ce0, 0xff2cc8, 2.2, 0.2)
    );
    core.position.set(0, 1.5, 0.95);

    const footGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const fll = new THREE.Mesh(footGeo, dm);
    fll.position.set(-0.55, 0.22, 0.35);
    fll.scale.set(1.2, 0.6, 1.4);
    const frr = new THREE.Mesh(footGeo, dm);
    frr.position.set(0.55, 0.22, 0.35);
    frr.scale.set(1.2, 0.6, 1.4);

    g.add(tail1, tail2, tailTip, body, head, snout, jaw, hl, hr, wl, wr, belly, core, fll, frr,
      AF.faceEyes(0xffe27a, 0x3a0a2a, 0.24, 2.5, 1.0, 0.09, 0x5a1a44), AF.blobShadow());
    return { group: g, parts: { body, head, wl, wr, core, tail: tail1 } };
  },

  powerup(type) {
    const conf = {
      freeze: { color: 0x5ad8ff, emissive: 0x2fb8ff },
      bomb: { color: 0xff7a4a, emissive: 0xff4a1a },
      shield: { color: 0x8aff9e, emissive: 0x3adf5e },
      slow: { color: 0xc9a2ff, emissive: 0x9a5cff },
      lightning: { color: 0xffe25c, emissive: 0xffc81a },
      heal: { color: 0xff5c6e, emissive: 0xff2a44 }
    }[type] || { color: 0xffffff, emissive: 0xaaaaaa };

    const g = new THREE.Group();
    const m = AF.glowPbr(conf.color, conf.emissive, 1.5, 0.18);

    let icon;
    if (type === "freeze") {
      icon = new THREE.Group();
      const spoke = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 6);
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(spoke, m);
        s.rotation.z = (k / 3) * Math.PI;
        icon.add(s);
      }
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 18), m);
      icon.add(fr);
    } else if (type === "bomb") {
      icon = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), m);
      icon.add(ball);
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), m);
      fuse.position.set(0.12, 0.5, 0);
      fuse.rotation.z = -0.5;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), m);
      spark.position.set(0.26, 0.68, 0);
      icon.add(fuse, spark);
    } else if (type === "shield") {
      icon = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.14, 6), m);
      plate.rotation.x = Math.PI / 2;
      plate.rotation.z = Math.PI / 6;
      const ridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), m);
      icon.add(plate, ridge);
    } else if (type === "slow") {
      icon = new THREE.Group();
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 8), m);
      top.position.y = 0.24;
      top.rotation.x = Math.PI;
      const bot = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 8), m);
      bot.position.y = -0.24;
      icon.add(top, bot);
    } else if (type === "lightning") {
      icon = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.12), m);
      b1.position.set(0.1, 0.28, 0);
      b1.rotation.z = 0.5;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.12), m);
      b2.position.set(-0.02, 0, 0);
      b2.rotation.z = -0.6;
      const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.12), m);
      b3.position.set(0.12, -0.3, 0);
      b3.rotation.z = 0.4;
      icon.add(b1, b2, b3);
    } else if (type === "heal") {
      icon = new THREE.Group();
      const lobe = new THREE.SphereGeometry(0.24, 12, 10);
      const l = new THREE.Mesh(lobe, m);
      l.position.set(-0.2, 0.18, 0);
      const r = new THREE.Mesh(lobe, m);
      r.position.set(0.2, 0.18, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.55, 12), m);
      tip.position.set(0, -0.22, 0);
      tip.rotation.x = Math.PI;
      tip.scale.z = 0.6;
      l.scale.z = r.scale.z = 0.6;
      icon.add(l, r, tip);
    } else {
      icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), m);
    }

    icon.position.y = 1.0;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 24), m);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.0;

    const light = new THREE.PointLight(conf.emissive, 1.1, 4);
    light.position.y = 1.0;

    g.add(icon, halo, light, AF.blobShadow());
    return { group: g, parts: { crystal: icon, halo } };
  }
};
