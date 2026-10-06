/* Math Survivor — procedural Three.js assets + textures. Zero external files. */
import * as THREE from "./vendor/three.module.js";

export const AF = {
  // ---------- procedural textures ----------
  floorTex(base, line) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { // noise speckle
      x.fillStyle = "rgba(255,255,255," + (Math.random() * 0.04) + ")";
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    x.strokeStyle = line; x.lineWidth = 2;
    for (let g = 0; g <= 4; g++) {
      x.beginPath(); x.moveTo(g * 64, 0); x.lineTo(g * 64, 256); x.stroke();
      x.beginPath(); x.moveTo(0, g * 64); x.lineTo(256, g * 64); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 6);
    return t;
  },
  glowTex(inner, outer) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, inner); g.addColorStop(0.55, outer); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  },
  runeTex(color) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    x.translate(128, 128);
    x.strokeStyle = color; x.lineWidth = 3;
    x.beginPath(); x.arc(0, 0, 110, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 8; i++) { // rune ticks
      const a = (i / 8) * Math.PI * 2;
      x.beginPath();
      x.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
      x.lineTo(Math.cos(a) * 110, Math.sin(a) * 110);
      x.stroke();
    }
    for (let i = 0; i < 5; i++) { // inner pentagram-ish glyph
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
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 8, 128, 128, 124);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.35, inner);
    g.addColorStop(0.75, inner.replace(/[\d.]+\)$/, "0.25)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,255,255,0.3)"; x.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.arc(128, 128, 30 + i * 18, i * 1.3, i * 1.3 + 2.2);
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  },

  // ---------- biome diorama ----------
  BIOME_PALS: [
    { stone: 0x4a4f66, stoneDark: 0x232838, deco: 0x6a7088, glow: 0x6f8cff, flame: 0xff8a3c, portal: "rgba(120,150,255,0.85)" },
    { stone: 0x3a3f58, stoneDark: 0x1b2033, deco: 0x7a5cc9, glow: 0x9a5cff, flame: 0x8a6cff, portal: "rgba(154,92,255,0.85)" },
    { stone: 0x4a3040, stoneDark: 0x231319, deco: 0x8a4a3a, glow: 0xff5a2a, flame: 0xff5a2a, portal: "rgba(255,90,42,0.85)" },
    { stone: 0x3d4f6e, stoneDark: 0x1d2940, deco: 0x5a7a9a, glow: 0x2fb8ff, flame: 0x7ad8ff, portal: "rgba(47,184,255,0.85)" },
    { stone: 0x443a66, stoneDark: 0x211b38, deco: 0x8a6ab8, glow: 0xc9a2ff, flame: 0xff5ce0, portal: "rgba(201,162,255,0.85)" }
  ],
  buildBiome(i) {
    const P = AF.BIOME_PALS[i % AF.BIOME_PALS.length];
    const g = new THREE.Group();
    const torchLights = [];
    const stone = new THREE.MeshStandardMaterial({ color: P.stone, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: P.stoneDark, roughness: 1 });
    const deco = new THREE.MeshStandardMaterial({ color: P.deco, roughness: 0.6, metalness: 0.2 });
    const glow = new THREE.MeshStandardMaterial({ color: P.glow, emissive: P.glow, emissiveIntensity: 1.4, roughness: 0.4 });
    const flameM = new THREE.MeshStandardMaterial({ color: 0xffc05c, emissive: P.flame, emissiveIntensity: 2.2 });
    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

    // side walls + cliff silhouettes for framing depth
    for (const sx of [-1, 1]) {
      const wall = box(1.4, 5.2, 26, stone); wall.position.set(sx * 7.3, 2.6, -1); g.add(wall);
      const ledge = box(0.7, 0.5, 26, dark); ledge.position.set(sx * 6.45, 5.2, -1); g.add(ledge);
      const cliff = box(3.2, 9, 30, dark); cliff.position.set(sx * 9.6, 4.2, -2); g.add(cliff);
    }
    // back wall with gate opening
    const bwL = box(4.6, 7, 1.4, stone); bwL.position.set(-5.1, 3.5, -11.6); g.add(bwL);
    const bwR = box(4.6, 7, 1.4, stone); bwR.position.set(5.1, 3.5, -11.6); g.add(bwR);
    const bwTop = box(14.4, 2.4, 1.4, stone); bwTop.position.set(0, 8.2, -11.6); g.add(bwTop);
    // archway pillars + keystone
    for (const sx of [-1, 1]) {
      const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6.4, 10), deco);
      ap.position.set(sx * 2.9, 3.2, -11.4); g.add(ap);
    }
    const keyStone = box(1.2, 1.0, 1.6, deco); keyStone.position.set(0, 6.8, -11.4); g.add(keyStone);
    // spawn portal behind the gate
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({ map: AF.portalTex(P.portal), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    portal.position.set(0, 3.0, -11.9); g.add(portal);
    // far background silhouettes (fog does the depth work)
    for (let k = 0; k < 5; k++) {
      const h = 5 + (k % 3) * 3;
      const b = box(6, h, 2, dark);
      b.position.set(-10 + k * 5, h / 2 - 0.5, -17 - (k % 2) * 3);
      b.rotation.y = (k - 2) * 0.12;
      g.add(b);
    }
    // soft lane guide strips
    const laneTex = AF.glowTex("rgba(160,190,255,0.5)", "rgba(120,150,255,0.15)");
    for (const lx of [-6, -3.6, -1.2, 1.2, 3.6, 6]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 21),
        new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.rotation.x = -Math.PI / 2; s.position.set(lx, 0.015, -1); g.add(s);
    }
    // hero hex platform + glowing rim
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.16, 6), deco);
    plat.position.set(0, 0.08, 5.2); g.add(plat);
    const platRim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 8, 6), glow);
    platRim.rotation.x = Math.PI / 2; platRim.rotation.z = Math.PI / 6;
    platRim.position.set(0, 0.17, 5.2); g.add(platRim);

    const brazier = (x, z, tall) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, tall, 6), deco);
      pole.position.set(x, tall / 2, z); g.add(pole);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.3, 8), deco);
      bowl.position.set(x, tall + 0.1, z); g.add(bowl);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), flameM);
      flame.position.set(x, tall + 0.34, z); flame.scale.y = 1.3; g.add(flame);
      const light = new THREE.PointLight(P.flame, 1.1, 9);
      light.position.set(x, tall + 0.5, z); g.add(light);
      torchLights.push({ flame, light, phase: Math.random() * 6.28 });
    };

    if (i % 5 === 0) { // Ancient Ruins: broken pillars, rubble, braziers
      const pillar = (x, z, h, broken) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, h, 9), stone);
        p.position.set(x, h / 2, z); g.add(p);
        if (broken) {
          const ch = box(0.9, 0.25, 0.9, stone); ch.position.set(x + 0.3, 0.12, z + 0.5); ch.rotation.y = 0.7; g.add(ch);
        } else {
          const cap = box(1.1, 0.3, 1.1, deco); cap.position.set(x, h + 0.15, z); g.add(cap);
        }
      };
      pillar(-6.3, -6.5, 3.6, false); pillar(6.3, -2.5, 2.4, true);
      pillar(-6.3, 1.5, 2.8, true); pillar(6.3, 4.5, 3.4, false);
      for (let k = 0; k < 6; k++) {
        const r = box(0.5 + Math.random() * 0.5, 0.3 + Math.random() * 0.3, 0.5, stone);
        r.position.set((k % 2 ? 1 : -1) * (5.6 + Math.random()), 0.2, -8 + k * 3);
        r.rotation.y = Math.random() * 3; g.add(r);
      }
      brazier(-6.2, -9, 1.5); brazier(6.2, -9, 1.5);
    } else if (i % 5 === 1) { // Dark Cavern: stalactites + glowing crystal clusters
      for (let k = 0; k < 7; k++) {
        const len = 1.2 + Math.random() * 1.6;
        const st = new THREE.Mesh(new THREE.ConeGeometry(0.3 + Math.random() * 0.2, len, 7), stone);
        st.position.set(-6 + k * 2 + (Math.random() - 0.5), 5.4 - len / 2, -10 + Math.random() * 14);
        st.rotation.x = Math.PI; g.add(st);
      }
      const cluster = (x, z, s) => {
        for (let k = 0; k < 3; k++) {
          const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 * s * (0.7 + Math.random() * 0.6)), glow);
          cr.position.set(x + (Math.random() - 0.5) * 0.8, 0.3 * s, z + (Math.random() - 0.5) * 0.8);
          cr.rotation.set(Math.random(), Math.random(), Math.random()); g.add(cr);
        }
      };
      cluster(-6.4, -7, 1.2); cluster(6.4, -3, 1); cluster(-6.5, 3, 0.9); cluster(6.3, 5, 1.1);
      brazier(-6.2, -9.5, 1.2); brazier(6.2, -9.5, 1.2);
    } else if (i % 5 === 2) { // Lava Depths: obsidian spikes + glowing floor cracks
      const spike = (x, z, h) => {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.35, h, 5), dark);
        s.position.set(x, h / 2, z); s.rotation.y = Math.random() * 3; g.add(s);
      };
      spike(-6.4, -7, 2.6); spike(6.4, -4, 3.2); spike(-6.3, 2, 2.2); spike(6.5, 5.5, 2.8);
      const crackM = new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + Math.random() * 0.4, 3 + Math.random() * 3), crackM);
        c.rotation.x = -Math.PI / 2; c.rotation.z = Math.random() * 0.6 - 0.3;
        c.position.set((k % 2 ? 1 : -1) * (5.4 + Math.random() * 0.8), 0.02, -8 + k * 3.5);
        g.add(c);
      }
      brazier(-6.2, -9, 1.4); brazier(6.2, -9, 1.4); brazier(-6.4, 4, 1.2); brazier(6.4, 4, 1.2);
    } else if (i % 5 === 3) { // Frozen Depths: ice shards + frost pillars
      const iceM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x2fb8ff, emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.85 });
      const shard = (x, z, h, tilt) => {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.3, h, 5), iceM);
        s.position.set(x, h / 2, z); s.rotation.z = tilt; g.add(s);
      };
      shard(-6.4, -7.5, 2.8, 0.15); shard(6.4, -5, 3.4, -0.12); shard(-6.3, 1, 2.2, 0.2); shard(6.4, 4.5, 2.6, -0.18);
      shard(-5.6, -10.5, 1.6, 0.3); shard(5.6, -10.5, 1.8, -0.3);
      for (const sx of [-1, 1]) {
        const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 7), stone);
        fp.position.set(sx * 6.6, 2.1, -3 + sx); g.add(fp);
      }
      brazier(-6.2, -9, 1.5); brazier(6.2, -9, 1.5);
    } else { // Arcane Realm: floating rune rings + orbiting crystals
      const rings = [], floaters = [];
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 + k * 0.5, 0.05, 8, 28), glow);
        r.position.set(0, 3.4 + k * 0.5, -11.2);
        r.rotation.x = 1.2 + k * 0.3;
        g.add(r); rings.push(r);
      }
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), glow);
        c.position.set((k % 2 ? 1 : -1) * (5.8 + Math.random()), 2.4 + Math.random() * 2, -9 + k * 2.6);
        g.add(c); floaters.push(c);
      }
      g.userData.floaters = floaters; g.userData.rings = rings;
      brazier(-6.2, -9.5, 1.3); brazier(6.2, -9.5, 1.3);
    }
    return { group: g, torchLights };
  },
  disposeBiome(b) {
    b.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  },
  // magenta crown + gem: elites readable without relying on the label
  eliteDeco(color) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: color, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.4 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), m);
    band.rotation.x = Math.PI / 2; g.add(band);
    const spikeGeo = new THREE.ConeGeometry(0.07, 0.26, 6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const sp = new THREE.Mesh(spikeGeo, m);
      sp.position.set(Math.cos(a) * 0.24, 0.14, Math.sin(a) * 0.24);
      sp.rotation.z = -Math.cos(a) * 0.4; sp.rotation.x = Math.sin(a) * 0.4;
      g.add(sp);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), m);
    gem.position.y = 0.26; g.add(gem);
    return g;
  },

  // ---------- shared bits ----------
  eyes(mat, dx, y, z, r) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(r || 0.09, 10, 10);
    const l = new THREE.Mesh(geo, mat); l.position.set(-dx, y, z);
    const rr = new THREE.Mesh(geo, mat); rr.position.set(dx, y, z);
    g.add(l, rr);
    return g;
  },
  // expressive eyes: white sclera + dark pupil + angry brow bar
  faceEyes(sclera, pupil, dx, y, z, r, browColor) {
    const g = new THREE.Group();
    const sGeo = new THREE.SphereGeometry(r, 10, 10);
    const pGeo = new THREE.SphereGeometry(r * 0.55, 8, 8);
    const bGeo = new THREE.BoxGeometry(r * 2.4, r * 0.5, r * 0.6);
    const bm = new THREE.MeshStandardMaterial({ color: browColor || 0x14182a, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: sclera }));
      s.position.set(sx * dx, y, z);
      const p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: pupil }));
      p.position.set(sx * dx, y, z + r * 0.62);
      const b = new THREE.Mesh(bGeo, bm);
      b.position.set(sx * dx, y + r * 1.35, z + r * 0.3);
      b.rotation.z = sx * 0.35; // angry slant
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
      new THREE.MeshBasicMaterial({ map: AF.glowTex("rgba(0,0,0,0.5)", "rgba(0,0,0,0.25)"), transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
    return m;
  },

  // ---------- characters ----------
  hero() {
    const g = new THREE.Group();
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x3f5cff, roughness: 0.55 });
    const robeMat2 = new THREE.MeshStandardMaterial({ color: 0x2b3fd0, roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd35c, roughness: 0.35, metalness: 0.4 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffd9b8, roughness: 0.7 });
    // layered robe: skirt + torso + shoulder cape
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 0.85, 14), robeMat);
    skirt.position.y = 0.43;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 4, 12), robeMat);
    torso.position.y = 1.06;
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.15, 12, 1, true), robeMat2);
    cape.position.set(0, 0.85, -0.14); cape.rotation.x = 0.12;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 22), gold);
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.12;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 8, 18), gold);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.86;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x7ef0ff, emissive: 0x2fd8ff, emissiveIntensity: 1.2 }));
    buckle.position.set(0, 0.86, 0.32);
    // head + wizard face
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 14), skin);
    head.position.y = 1.62;
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.8 }));
    beard.position.set(0, 1.38, 0.14); beard.rotation.x = 0.3;
    const mustache = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.8 }));
    mustache.position.set(0, 1.52, 0.24); mustache.rotation.x = Math.PI + 0.2;
    const face = AF.faceEyes(0xffffff, 0x1a1a2e, 0.1, 1.68, 0.25, 0.05, 0xd8d2c4);
    // pointy hat with brim + band + star
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.06, 16), robeMat2);
    brim.position.y = 1.86;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 12), robeMat);
    hat.position.y = 2.28; hat.rotation.z = -0.14;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 16), gold);
    band.rotation.x = Math.PI / 2; band.position.y = 1.95;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: 0xffe25c, emissive: 0xffc81a, emissiveIntensity: 1.6 }));
    star.position.set(0.12, 2.52, 0.14);
    // arms with mitten hands
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.34, 4, 8);
    const handGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const armL = new THREE.Mesh(armGeo, robeMat); armL.position.set(-0.36, 1.05, 0.05); armL.rotation.z = 0.5;
    const handL = new THREE.Mesh(handGeo, skin); handL.position.set(-0.52, 0.88, 0.08);
    const armR = new THREE.Mesh(armGeo, robeMat); armR.position.set(0.36, 1.08, 0.12); armR.rotation.z = -0.75;
    const handR = new THREE.Mesh(handGeo, skin); handR.position.set(0.55, 0.92, 0.18);
    // boots peeking out
    const bootGeo = new THREE.CapsuleGeometry(0.09, 0.12, 4, 8);
    const bootM = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.8 });
    const bootL = new THREE.Mesh(bootGeo, bootM); bootL.position.set(-0.16, 0.08, 0.12); bootL.rotation.x = Math.PI / 2;
    const bootR = new THREE.Mesh(bootGeo, bootM); bootR.position.set(0.16, 0.08, 0.12); bootR.rotation.x = Math.PI / 2;
    // staff: rod + claw prongs + orb + rotating ring
    const staff = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1.75, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
    rod.position.y = 0.88;
    const clawGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.34, 6);
    for (const sx of [-1, 1]) {
      const claw = new THREE.Mesh(clawGeo, gold);
      claw.position.set(sx * 0.11, 1.72, 0);
      claw.rotation.z = sx * -0.5;
      staff.add(claw);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), new THREE.MeshStandardMaterial({ color: 0x7ef0ff, emissive: 0x2fd8ff, emissiveIntensity: 1.6 }));
    orb.position.y = 1.82;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 8, 24), new THREE.MeshStandardMaterial({ color: 0x7ef0ff, emissive: 0x2fd8ff, emissiveIntensity: 1.1 }));
    ring.position.y = 1.82; ring.rotation.x = 1.1;
    const orbLight = new THREE.PointLight(0x45e0ff, 1.4, 5);
    orbLight.position.y = 1.82;
    staff.add(rod, orb, ring, orbLight);
    staff.position.set(0.66, 0, 0.16);
    g.add(skirt, torso, cape, trim, belt, buckle, head, beard, mustache, face,
      brim, hat, band, star, armL, handL, armR, handR, bootL, bootR, staff);
    g.add(AF.blobShadow());
    return { group: g, parts: { robe: torso, head, hat, staff, orb, ring, beard, face } };
  },

  slime(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.95 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), mat);
    body.scale.y = 0.78; body.position.y = 0.5;
    // drip blob on top for gooey silhouette
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat);
    drip.position.set(0.18, 0.92, 0.1); drip.scale.y = 1.4;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    shine.position.set(-0.22, 0.78, 0.35);
    // stubby arms + feet
    const stub = new THREE.SphereGeometry(0.13, 10, 8);
    const al = new THREE.Mesh(stub, mat); al.position.set(-0.58, 0.42, 0.12); al.scale.set(1, 0.8, 0.8);
    const ar = new THREE.Mesh(stub, mat); ar.position.set(0.58, 0.42, 0.12); ar.scale.set(1, 0.8, 0.8);
    const footGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const fl = new THREE.Mesh(footGeo, mat); fl.position.set(-0.24, 0.1, 0.28); fl.scale.set(1.2, 0.6, 1.4);
    const fr = new THREE.Mesh(footGeo, mat); fr.position.set(0.24, 0.1, 0.28); fr.scale.set(1.2, 0.6, 1.4);
    const face = AF.faceEyes(0xffffff, 0x10231a, 0.18, 0.62, 0.5, 0.09, color);
    const mouth = AF.mouth(0x10231a, 0, 0.44, 0.55, 0.17, 0.06);
    g.add(body, drip, shine, al, ar, fl, fr, face, mouth, AF.blobShadow());
    return { group: g, parts: { body, al, ar, mouth, face } };
  },

  bat(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), mat);
    body.position.y = 1.15; body.scale.set(0.9, 1.05, 0.9);
    // membrane wings (flattened cones) with bone ridge
    const wingGeo = new THREE.ConeGeometry(0.42, 0.9, 4, 1, true);
    const wm = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, wm); wl.position.set(-0.55, 1.25, 0); wl.rotation.z = 1.25; wl.scale.z = 0.35;
    const wr = new THREE.Mesh(wingGeo, wm); wr.position.set(0.55, 1.25, 0); wr.rotation.z = -1.25; wr.scale.z = 0.35;
    const boneGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6);
    const bl = new THREE.Mesh(boneGeo, mat); bl.position.set(-0.55, 1.25, 0); bl.rotation.z = 1.25;
    const br = new THREE.Mesh(boneGeo, mat); br.position.set(0.55, 1.25, 0); br.rotation.z = -1.25;
    // big ears + fangs + face
    const earGeo = new THREE.ConeGeometry(0.11, 0.3, 8);
    const el = new THREE.Mesh(earGeo, mat); el.position.set(-0.2, 1.52, 0); el.rotation.z = 0.25;
    const er = new THREE.Mesh(earGeo, mat); er.position.set(0.2, 1.52, 0); er.rotation.z = -0.25;
    const fangGeo = new THREE.ConeGeometry(0.04, 0.12, 6);
    const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const fangL = new THREE.Mesh(fangGeo, fm); fangL.position.set(-0.1, 1.0, 0.34); fangL.rotation.x = 0.2;
    const fangR = new THREE.Mesh(fangGeo, fm); fangR.position.set(0.1, 1.0, 0.34); fangR.rotation.x = 0.2;
    const face = AF.faceEyes(0xffe27a, 0x2a0e1e, 0.14, 1.24, 0.33, 0.08, 0x14182a);
    const mouth = AF.mouth(0x2a0e1e, 0, 1.05, 0.37, 0.11, 0.04);
    g.add(body, wl, wr, bl, br, el, er, fangL, fangR, face, mouth, AF.blobShadow());
    return { group: g, parts: { body, wl, wr, hover: 1.15, face, mouth } };
  },

  skeleton(color) {
    const g = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.5 });
    // skull + jaw + ribs + pelvis + limb bones
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), bm); head.position.y = 1.62;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.2), bm); jaw.position.set(0, 1.44, 0.1);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), bm); torso.position.y = 0.95;
    const ribGeo = new THREE.TorusGeometry(0.2, 0.028, 6, 14, Math.PI * 1.4);
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(ribGeo, bm);
      rib.position.set(0, 1.12 - i * 0.14, 0.02);
      rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.8;
      g.add(rib);
    }
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.2), bm); pelvis.position.y = 0.62;
    const legGeo = new THREE.CapsuleGeometry(0.06, 0.42, 4, 8);
    const ll = new THREE.Mesh(legGeo, bm); ll.position.set(-0.14, 0.32, 0);
    const lr = new THREE.Mesh(legGeo, bm); lr.position.set(0.14, 0.32, 0);
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.5, 4, 8);
    const al = new THREE.Mesh(armGeo, bm); al.position.set(-0.4, 1.0, 0); al.rotation.z = 0.35;
    const ar = new THREE.Mesh(armGeo, bm); ar.position.set(0.4, 1.0, 0); ar.rotation.z = -0.35;
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 }));
    sword.position.set(0.52, 1.35, 0.1); sword.rotation.z = -0.4;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), bm); guard.position.set(0.46, 1.05, 0.1); guard.rotation.z = -0.4;
    const face = AF.faceEyes(0xd94040, 0x3a0a0a, 0.1, 1.66, 0.24, 0.055, 0x8a8676);
    g.add(head, jaw, torso, pelvis, ll, lr, al, ar, sword, guard, face, AF.blobShadow());
    return { group: g, parts: { body: torso, head, al, ar, face } };
  },

  golem(color) {
    const g = new THREE.Group();
    const sm = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const sm2 = new THREE.MeshStandardMaterial({ color: color, roughness: 0.95 });
    sm2.color.multiplyScalar(0.8);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), sm2); legs.position.y = 0.3;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.65), sm); torso.position.y = 1.0;
    // asymmetric shoulder boulders
    const shGeo = new THREE.DodecahedronGeometry(0.3);
    const shl = new THREE.Mesh(shGeo, sm2); shl.position.set(-0.62, 1.35, 0); shl.rotation.set(0.4, 0.8, 0.2);
    const shr = new THREE.Mesh(shGeo, sm2); shr.position.set(0.62, 1.32, 0.05); shr.rotation.set(0.9, 0.2, 0.6);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), sm); head.position.y = 1.66;
    head.rotation.y = 0.15;
    const fistGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const fl = new THREE.Mesh(fistGeo, sm2); fl.position.set(-0.72, 0.85, 0.15);
    const fr = new THREE.Mesh(fistGeo, sm2); fr.position.set(0.72, 0.85, 0.15);
    // glowing cracks across the torso
    const crackM = new THREE.MeshStandardMaterial({ color: 0xff7a3c, emissive: 0xff5a1c, emissiveIntensity: 1.5 });
    const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), crackM); crack1.position.set(-0.15, 1.05, 0.34); crack1.rotation.z = 0.3;
    const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.03), crackM); crack2.position.set(0.2, 0.9, 0.34); crack2.rotation.z = -0.5;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), crackM);
    crystal.position.set(0, 1.05, 0.36);
    // moss patches for character
    const mossM = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 });
    const moss1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mossM); moss1.position.set(-0.3, 1.42, 0.2); moss1.scale.y = 0.5;
    const moss2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mossM); moss2.position.set(0.35, 0.55, 0.24); moss2.scale.y = 0.5;
    g.add(legs, torso, shl, shr, head, fl, fr, crack1, crack2, crystal, moss1, moss2,
      AF.eyes(new THREE.MeshBasicMaterial({ color: 0xffa53c }), 0.12, 1.7, 0.24, 0.06), AF.blobShadow());
    return { group: g, parts: { body: torso, head, fl, fr, crystal } };
  },

  ghost(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat);
    body.position.y = 1.15;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 12), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.3 }));
    tail.position.y = 0.62; tail.rotation.x = Math.PI;
    // wispy arms
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.3, 4, 8);
    const al = new THREE.Mesh(armGeo, mat); al.position.set(-0.5, 1.05, 0.1); al.rotation.z = 0.8;
    const ar = new THREE.Mesh(armGeo, mat); ar.position.set(0.5, 1.05, 0.1); ar.rotation.z = -0.8;
    // little crown for personality
    const crownM = new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xaa7a10, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.4 });
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
    const dm = new THREE.MeshStandardMaterial({ color: 0x8e2f6e, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), dm); body.position.y = 1.35; body.scale.set(1, 0.9, 1.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), dm); head.position.set(0, 2.35, 0.55);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), dm); snout.position.set(0, 2.2, 1.05);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), dm); jaw.position.set(0, 2.02, 1.05);
    const fangGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
    const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const f1 = new THREE.Mesh(fangGeo, fm); f1.position.set(sx * 0.16, 2.12, 1.26); f1.rotation.x = Math.PI;
      const f2 = new THREE.Mesh(fangGeo, fm); f2.position.set(sx * 0.16, 2.16, 1.26);
      g.add(f1, f2);
    }
    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
    const hm = new THREE.MeshStandardMaterial({ color: 0xffd35c, roughness: 0.4 });
    const hl = new THREE.Mesh(hornGeo, hm); hl.position.set(-0.3, 2.85, 0.4); hl.rotation.z = 0.3;
    const hr = new THREE.Mesh(hornGeo, hm); hr.position.set(0.3, 2.85, 0.4); hr.rotation.z = -0.3;
    // spiky ridge down the back
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.3, 6);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(spikeGeo, hm);
      sp.position.set(0, 2.1 - i * 0.28, -0.55 - i * 0.32);
      sp.rotation.x = -0.5;
      g.add(sp);
    }
    // tail with tip
    const tail1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 10), dm);
    tail1.position.set(0, 0.9, -1.15); tail1.rotation.x = 1.2;
    const tail2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 4, 10), dm);
    tail2.position.set(0, 0.75, -1.85); tail2.rotation.x = 1.45;
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), hm);
    tailTip.position.set(0, 0.7, -2.35); tailTip.rotation.x = 1.6;
    const wingGeo = new THREE.ConeGeometry(0.9, 1.9, 4, 1, true);
    const wg = new THREE.MeshStandardMaterial({ color: 0x6d2252, roughness: 0.7, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, wg); wl.position.set(-1.35, 1.9, -0.2); wl.rotation.z = 1.15; wl.scale.z = 0.4;
    const wr = new THREE.Mesh(wingGeo, wg); wr.position.set(1.35, 1.9, -0.2); wr.rotation.z = -1.15; wr.scale.z = 0.4;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 }));
    belly.position.set(0, 1.1, 0.55); belly.scale.set(0.8, 0.85, 0.5);
    // plated belly segments
    const plateGeo = new THREE.TorusGeometry(0.42, 0.05, 6, 14, Math.PI);
    const plateM = new THREE.MeshStandardMaterial({ color: 0xd9a53a, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(plateGeo, plateM);
      pl.position.set(0, 0.85 + i * 0.28, 0.72);
      pl.rotation.y = Math.PI; pl.rotation.x = 0.35;
      g.add(pl);
    }
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshStandardMaterial({ color: 0xff5ce0, emissive: 0xff2cc8, emissiveIntensity: 1.6 }));
    core.position.set(0, 1.5, 0.95);
    // clawed feet
    const footGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const fll = new THREE.Mesh(footGeo, dm); fll.position.set(-0.55, 0.22, 0.35); fll.scale.set(1.2, 0.6, 1.4);
    const frr = new THREE.Mesh(footGeo, dm); frr.position.set(0.55, 0.22, 0.35); frr.scale.set(1.2, 0.6, 1.4);
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
    const m = new THREE.MeshStandardMaterial({ color: conf.color, emissive: conf.emissive, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.2 });
    let icon;
    if (type === "freeze") { // snowflake: 6 spokes + ring
      icon = new THREE.Group();
      const spoke = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 6);
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(spoke, m);
        s.rotation.z = (k / 3) * Math.PI;
        icon.add(s);
      }
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 18), m);
      icon.add(fr);
    } else if (type === "bomb") { // round bomb + fuse spark
      icon = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), m);
      icon.add(ball);
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), m);
      fuse.position.set(0.12, 0.5, 0); fuse.rotation.z = -0.5;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), m);
      spark.position.set(0.26, 0.68, 0);
      icon.add(fuse, spark);
    } else if (type === "shield") { // shield plate + boss ridge
      icon = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.14, 6), m);
      plate.rotation.x = Math.PI / 2; plate.rotation.z = Math.PI / 6;
      const ridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), m);
      icon.add(plate, ridge);
    } else if (type === "slow") { // hourglass: two cones + post
      icon = new THREE.Group();
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 8), m);
      top.position.y = 0.24; top.rotation.x = Math.PI;
      const bot = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 8), m);
      bot.position.y = -0.24;
      icon.add(top, bot);
    } else if (type === "lightning") { // zigzag bolt from stacked boxes
      icon = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.12), m);
      b1.position.set(0.1, 0.28, 0); b1.rotation.z = 0.5;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.12), m);
      b2.position.set(-0.02, 0, 0); b2.rotation.z = -0.6;
      const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.12), m);
      b3.position.set(0.12, -0.3, 0); b3.rotation.z = 0.4;
      icon.add(b1, b2, b3);
    } else if (type === "heal") { // heart: two spheres + inverted cone
      icon = new THREE.Group();
      const lobe = new THREE.SphereGeometry(0.24, 12, 10);
      const l = new THREE.Mesh(lobe, m); l.position.set(-0.2, 0.18, 0);
      const r = new THREE.Mesh(lobe, m); r.position.set(0.2, 0.18, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.55, 12), m);
      tip.position.set(0, -0.22, 0); tip.rotation.x = Math.PI; tip.scale.z = 0.6;
      l.scale.z = r.scale.z = 0.6;
      icon.add(l, r, tip);
    } else {
      icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), m);
    }
    icon.position.y = 1.0;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 24), m);
    halo.rotation.x = Math.PI / 2; halo.position.y = 1.0;
    const light = new THREE.PointLight(conf.emissive, 1.1, 4);
    light.position.y = 1.0;
    g.add(icon, halo, light, AF.blobShadow());
    return { group: g, parts: { crystal: icon, halo } };
  }
};
