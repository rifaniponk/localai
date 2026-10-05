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

  // ---------- shared bits ----------
  eyes(mat, dx, y, z, r) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(r || 0.09, 10, 10);
    const l = new THREE.Mesh(geo, mat); l.position.set(-dx, y, z);
    const rr = new THREE.Mesh(geo, mat); rr.position.set(dx, y, z);
    g.add(l, rr);
    return g;
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
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 12), new THREE.MeshStandardMaterial({ color: 0x3f5cff, roughness: 0.6 }));
    robe.position.y = 0.68;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), new THREE.MeshStandardMaterial({ color: 0xffd35c, roughness: 0.4, metalness: 0.3 }));
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffd9b8, roughness: 0.7 }));
    head.position.y = 1.62;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.75, 12), new THREE.MeshStandardMaterial({ color: 0x2b3fd0, roughness: 0.6 }));
    hat.position.y = 2.12; hat.rotation.z = -0.12;
    const face = AF.eyes(new THREE.MeshBasicMaterial({ color: 0x1a1a2e }), 0.11, 1.66, 0.26, 0.05);
    const staff = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.7, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 }));
    rod.position.y = 0.85;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), new THREE.MeshStandardMaterial({ color: 0x7ef0ff, emissive: 0x2fd8ff, emissiveIntensity: 1.6 }));
    orb.position.y = 1.78;
    const orbLight = new THREE.PointLight(0x45e0ff, 1.4, 5);
    orbLight.position.y = 1.78;
    staff.add(rod, orb, orbLight);
    staff.position.set(0.62, 0, 0.1);
    g.add(robe, trim, head, hat, face, staff);
    g.add(AF.blobShadow());
    return { group: g, parts: { robe, head, hat, staff, orb } };
  },

  slime(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
    body.scale.y = 0.78; body.position.y = 0.5;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    shine.position.set(-0.22, 0.78, 0.35);
    g.add(body, shine, AF.eyes(new THREE.MeshBasicMaterial({ color: 0x10231a }), 0.18, 0.6, 0.5, 0.08), AF.blobShadow());
    return { group: g, parts: { body } };
  },
  bat(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    body.position.y = 1.15;
    const wingGeo = new THREE.ConeGeometry(0.42, 0.9, 4, 1, true);
    const wm = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, wm); wl.position.set(-0.55, 1.25, 0); wl.rotation.z = 1.25;
    const wr = new THREE.Mesh(wingGeo, wm); wr.position.set(0.55, 1.25, 0); wr.rotation.z = -1.25;
    const ears = AF.eyes(new THREE.MeshBasicMaterial({ color: 0xffe27a }), 0.13, 1.25, 0.34, 0.07);
    g.add(body, wl, wr, ears, AF.blobShadow());
    return { group: g, parts: { body, wl, wr, hover: 1.15 } };
  },
  skeleton(color) {
    const g = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 10), bm); body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), bm); head.position.y = 1.62;
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
    const al = new THREE.Mesh(armGeo, bm); al.position.set(-0.4, 1.0, 0); al.rotation.z = 0.35;
    const ar = new THREE.Mesh(armGeo, bm); ar.position.set(0.4, 1.0, 0); ar.rotation.z = -0.35;
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 }));
    sword.position.set(0.52, 1.35, 0.1); sword.rotation.z = -0.4;
    g.add(body, head, al, ar, sword, AF.eyes(new THREE.MeshBasicMaterial({ color: 0xd94040 }), 0.1, 1.66, 0.24, 0.055), AF.blobShadow());
    return { group: g, parts: { body, head, al, ar } };
  },
  golem(color) {
    const g = new THREE.Group();
    const sm = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), sm); legs.position.y = 0.3;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.65), sm); torso.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), sm); head.position.y = 1.66;
    const fistGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const fl = new THREE.Mesh(fistGeo, sm); fl.position.set(-0.72, 0.85, 0.15);
    const fr = new THREE.Mesh(fistGeo, sm); fr.position.set(0.72, 0.85, 0.15);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: 0xff7a3c, emissive: 0xff5a1c, emissiveIntensity: 1.4 }));
    crystal.position.set(0, 1.05, 0.36);
    g.add(legs, torso, head, fl, fr, crystal, AF.eyes(new THREE.MeshBasicMaterial({ color: 0xffa53c }), 0.12, 1.7, 0.24, 0.06), AF.blobShadow());
    return { group: g, parts: { body: torso, head, fl, fr } };
  },
  ghost(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.3 }));
    body.position.y = 1.15;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 12), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.3 }));
    tail.position.y = 0.62; tail.rotation.x = Math.PI;
    g.add(body, tail, AF.eyes(new THREE.MeshBasicMaterial({ color: 0x18324a }), 0.16, 1.25, 0.42, 0.08), AF.blobShadow());
    return { group: g, parts: { body, tail, hover: 1.15 } };
  },
  bossDragon() {
    const g = new THREE.Group();
    const dm = new THREE.MeshStandardMaterial({ color: 0x8e2f6e, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), dm); body.position.y = 1.35; body.scale.set(1, 0.9, 1.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), dm); head.position.set(0, 2.35, 0.55);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), dm); snout.position.set(0, 2.2, 1.05);
    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
    const hm = new THREE.MeshStandardMaterial({ color: 0xffd35c, roughness: 0.4 });
    const hl = new THREE.Mesh(hornGeo, hm); hl.position.set(-0.3, 2.85, 0.4); hl.rotation.z = 0.3;
    const hr = new THREE.Mesh(hornGeo, hm); hr.position.set(0.3, 2.85, 0.4); hr.rotation.z = -0.3;
    const wingGeo = new THREE.ConeGeometry(0.9, 1.9, 4, 1, true);
    const wg = new THREE.MeshStandardMaterial({ color: 0x6d2252, roughness: 0.7, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, wg); wl.position.set(-1.35, 1.9, -0.2); wl.rotation.z = 1.15;
    const wr = new THREE.Mesh(wingGeo, wg); wr.position.set(1.35, 1.9, -0.2); wr.rotation.z = -1.15;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 }));
    belly.position.set(0, 1.1, 0.55); belly.scale.set(0.8, 0.85, 0.5);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshStandardMaterial({ color: 0xff5ce0, emissive: 0xff2cc8, emissiveIntensity: 1.6 }));
    core.position.set(0, 1.5, 0.95);
    g.add(body, head, snout, hl, hr, wl, wr, belly, core,
      AF.eyes(new THREE.MeshBasicMaterial({ color: 0xffe27a }), 0.24, 2.5, 1.0, 0.09), AF.blobShadow());
    return { group: g, parts: { body, head, wl, wr, core } };
  },

  powerup(type) {
    const conf = {
      freeze: { color: 0x5ad8ff, emissive: 0x2fb8ff },
      bomb: { color: 0xff7a4a, emissive: 0xff4a1a },
      shield: { color: 0x8aff9e, emissive: 0x3adf5e },
      slow: { color: 0xc9a2ff, emissive: 0x9a5cff },
      lightning: { color: 0xffe25c, emissive: 0xffc81a }
    }[type] || { color: 0xffffff, emissive: 0xaaaaaa };
    const g = new THREE.Group();
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color: conf.color, emissive: conf.emissive, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.2 }));
    crystal.position.y = 1.0;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 24), new THREE.MeshStandardMaterial({ color: conf.color, emissive: conf.emissive, emissiveIntensity: 1.0 }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 1.0;
    const light = new THREE.PointLight(conf.emissive, 1.1, 4);
    light.position.y = 1.0;
    g.add(crystal, halo, light, AF.blobShadow());
    return { group: g, parts: { crystal, halo } };
  }
};
