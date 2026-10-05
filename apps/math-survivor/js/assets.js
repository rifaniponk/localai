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
