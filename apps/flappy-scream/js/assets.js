/* ============================================================
   assets.js — SEMUA aset digenerate prosedural via canvas.
   Tidak ada file gambar eksternal.
   ============================================================ */
'use strict';

const Assets = {
  bird: null,        // { frames: [canvas x6 flap], scream: canvas }
  birdW: 66, birdH: 52,
  cloud: null,       // [canvas x3 variasi]
  mountain: null,    // canvas strip (parallax jauh)
  skyline: null,     // canvas strip (parallax tengah)
  hill: null,        // canvas strip (parallax dekat)
  ground: null,      // canvas strip (scroll cepat)
  pipeTop: null, pipeBot: null,
  pipeW: 92,

  build() {
    this._bird();
    this._clouds();
    this._mountain();
    this._skyline();
    this._hill();
    this._ground();
    this._pipes();
  },

  _c(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },

  /* ---------------- BURUNG (6 pose kepakan + pose teriak) ---------------- */
  _bird() {
    const W = this.birdW, H = this.birdH;
    const wingAngles = [0.55, 0.25, -0.05, -0.35, -0.55, -0.2]; // fase flap
    this.bird = { frames: [], scream: null };

    const draw = (wingA, screaming) => {
      const c = this._c(W, H), g = c.getContext('2d');
      g.translate(W / 2, H / 2);

      // ekor
      g.fillStyle = '#e8862e';
      g.beginPath();
      g.moveTo(-24, -4); g.lineTo(-33, -10); g.lineTo(-31, 2); g.lineTo(-33, 10); g.lineTo(-24, 8);
      g.closePath(); g.fill();

      // badan (gradien)
      const body = g.createLinearGradient(0, -20, 0, 22);
      body.addColorStop(0, '#ffd94a'); body.addColorStop(0.6, '#ffb02e'); body.addColorStop(1, '#f08a1e');
      g.fillStyle = body;
      g.beginPath(); g.ellipse(0, 0, 24, 19, 0, 0, Math.PI * 2); g.fill();

      // perut terang
      g.fillStyle = '#fff3c4';
      g.beginPath(); g.ellipse(4, 7, 14, 9, 0, 0, Math.PI * 2); g.fill();

      // sayap (rotasi sesuai fase)
      g.save();
      g.translate(-4, -2); g.rotate(wingA);
      const wg = g.createLinearGradient(0, -4, 0, 16);
      wg.addColorStop(0, '#ff9d2e'); wg.addColorStop(1, '#e06a12');
      g.fillStyle = wg;
      g.beginPath(); g.ellipse(-6, 6, 15, 9, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.ellipse(-8, 4, 8, 4, 0.5, 0, Math.PI * 2); g.fill();
      g.restore();

      // kepala
      const hd = g.createLinearGradient(10, -22, 10, -4);
      hd.addColorStop(0, '#ffe27a'); hd.addColorStop(1, '#ffb63a');
      g.fillStyle = hd;
      g.beginPath(); g.arc(13, -10, 12, 0, Math.PI * 2); g.fill();

      // jambul
      g.fillStyle = '#e8862e';
      g.beginPath(); g.moveTo(6, -20); g.lineTo(2, -27); g.lineTo(11, -22); g.closePath(); g.fill();

      // mata
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(17, -12, 5.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#22252b';
      g.beginPath(); g.arc(18.5, -12, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(19.5, -13, 1, 0, Math.PI * 2); g.fill();

      // paruh
      g.fillStyle = '#ff6b35';
      if (screaming) {
        // paruh terbuka lebar (lagi teriak!)
        g.beginPath(); g.moveTo(22, -12); g.lineTo(36, -14); g.lineTo(26, -8); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(22, -6); g.lineTo(34, -2); g.lineTo(24, -9); g.closePath(); g.fill();
        g.fillStyle = '#8c1f1f';
        g.beginPath(); g.moveTo(24, -9); g.lineTo(33, -8); g.lineTo(25, -6); g.closePath(); g.fill();
      } else {
        g.beginPath(); g.moveTo(22, -12); g.lineTo(34, -9); g.lineTo(22, -5); g.closePath(); g.fill();
      }

      // kaki
      g.strokeStyle = '#e0641a'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(2, 16); g.lineTo(0, 22); g.moveTo(8, 16); g.lineTo(7, 22); g.stroke();

      // outline halus
      g.globalAlpha = 0.15; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, 0, 24, 19, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      return c;
    };

    for (const a of wingAngles) this.bird.frames.push(draw(a, false));
    this.bird.scream = draw(-0.55, true);
  },

  /* ---------------- AWAN ---------------- */
  _clouds() {
    this.cloud = [];
    for (let v = 0; v < 3; v++) {
      const c = this._c(220, 90), g = c.getContext('2d');
      const puffs = [[40, 55, 26], [80, 42, 32], [125, 48, 27], [165, 56, 22], [100, 60, 30]];
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      for (const [x, y, r] of puffs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
      g.fill();
      g.fillStyle = 'rgba(210,228,245,0.55)';
      g.beginPath();
      for (const [x, y, r] of puffs) { g.moveTo(x + r * .8, y + r * .55); g.arc(x, y + r * .55, r * .8, 0, Math.PI * 2); }
      g.fill();
      this.cloud.push(c);
    }
  },

  /* ---------------- MOUNTAIN (parallax terjauh) ---------------- */
  _mountain() {
    const W = 1600, H = 260, c = this._c(W, H), g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#8fa8cc'); grad.addColorStop(1, '#b9cbe2');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, H);
    let x = 0, peak = 90;
    while (x < W) {
      const w = 140 + Math.random() * 180;
      peak = 60 + Math.random() * 130;
      g.lineTo(x + w / 2, H - peak);
      g.lineTo(x + w, H - (40 + Math.random() * 50));
      x += w;
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    // salju puncak
    g.fillStyle = 'rgba(255,255,255,.75)';
    x = 0;
    while (x < W) {
      const w = 140 + Math.random() * 180, p = 60 + Math.random() * 130;
      if (p > 140) {
        g.beginPath();
        g.moveTo(x + w / 2, H - p);
        g.lineTo(x + w / 2 - 18, H - p + 26); g.lineTo(x + w / 2 + 18, H - p + 26);
        g.closePath(); g.fill();
      }
      x += w;
    }
    this.mountain = c;
  },

  /* ---------------- SKYLINE kota (parallax tengah) ---------------- */
  _skyline() {
    const W = 1600, H = 220, c = this._c(W, H), g = c.getContext('2d');
    g.fillStyle = '#5d7ba6';
    let x = 0;
    while (x < W) {
      const bw = 46 + Math.random() * 70, bh = 60 + Math.random() * 130;
      g.fillRect(x, H - bh, bw, bh);
      // antena
      if (Math.random() < 0.3) { g.fillRect(x + bw / 2 - 1, H - bh - 16, 2, 16); }
      // jendela
      g.fillStyle = 'rgba(255,236,160,.5)';
      for (let wy = H - bh + 10; wy < H - 12; wy += 16)
        for (let wx = x + 6; wx < x + bw - 8; wx += 14)
          if (Math.random() < 0.5) g.fillRect(wx, wy, 5, 7);
      g.fillStyle = '#5d7ba6';
      x += bw + 8;
    }
    this.skyline = c;
  },

  /* ---------------- HILLS (parallax dekat) ---------------- */
  _hill() {
    const W = 1600, H = 150, c = this._c(W, H), g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#6fbf5e'); grad.addColorStop(1, '#4a9a44');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 80) g.quadraticCurveTo(x + 40, H - (55 + 45 * Math.abs(Math.sin(x * 0.013))), x + 80, H - 30);
    g.lineTo(W, H); g.closePath(); g.fill();
    // pohon kecil
    g.fillStyle = '#3d7d38';
    for (let i = 0; i < 26; i++) {
      const tx = Math.random() * W, ty = H - 40 - Math.random() * 45;
      g.beginPath(); g.moveTo(tx, ty - 18); g.lineTo(tx - 8, ty); g.lineTo(tx + 8, ty); g.closePath(); g.fill();
    }
    this.hill = c;
  },

  /* ---------------- GROUND ---------------- */
  _ground() {
    const W = 800, H = 96, c = this._c(W, H), g = c.getContext('2d');
    // rumput atas
    const gg = g.createLinearGradient(0, 0, 0, 26);
    gg.addColorStop(0, '#8ed06a'); gg.addColorStop(1, '#5da84a');
    g.fillStyle = gg; g.fillRect(0, 0, W, 26);
    // tanah
    const dg = g.createLinearGradient(0, 26, 0, H);
    dg.addColorStop(0, '#c99a5b'); dg.addColorStop(1, '#a87c42');
    g.fillStyle = dg; g.fillRect(0, 26, W, H - 26);
    // garis rumput
    g.strokeStyle = '#4c8a3c'; g.lineWidth = 2;
    for (let x = 0; x < W; x += 14) {
      g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 4, 14 + (x % 3) * 3); g.stroke();
    }
    // kerikil
    g.fillStyle = 'rgba(90,60,30,.5)';
    for (let i = 0; i < 40; i++) {
      g.beginPath(); g.ellipse(Math.random() * W, 34 + Math.random() * 55, 3 + Math.random() * 4, 2 + Math.random() * 2, 0, 0, Math.PI * 2); g.fill();
    }
    this.ground = c;
  },

  /* ---------------- PIPES (pipa berdaun, gaya tanaman) ---------------- */
  _pipes() {
    const W = this.pipeW;
    const body = (g, x, y, h, flip) => {
      const grad = g.createLinearGradient(x, 0, x + W, 0);
      grad.addColorStop(0, '#2e8b3d'); grad.addColorStop(0.35, '#57c25f');
      grad.addColorStop(0.55, '#7fd97c'); grad.addColorStop(0.75, '#46a84e'); grad.addColorStop(1, '#236b2e');
      g.fillStyle = grad;
      g.fillRect(x + 8, y, W - 16, h);
      // cup (mulut pipa)
      const cupH = 34;
      const cy = flip ? y : y + h - cupH;
      const cg = g.createLinearGradient(x, 0, x + W, 0);
      cg.addColorStop(0, '#2a7d36'); cg.addColorStop(0.4, '#63cc68');
      cg.addColorStop(0.6, '#8ce288'); cg.addColorStop(1, '#1f5f28');
      g.fillStyle = cg;
      this._rr(g, x, cy, W, cupH, 8); g.fill();
      g.strokeStyle = 'rgba(0,40,10,.35)'; g.lineWidth = 2;
      this._rr(g, x, cy, W, cupH, 8); g.stroke();
      g.strokeRect(x + 8, y, W - 16, h);
      // daun di sambungan
      g.fillStyle = '#3f9a45';
      const lx = flip ? cy + cupH : cy;
      g.beginPath();
      g.moveTo(x + W - 8, lx); g.quadraticCurveTo(x + W + 16, lx - 6, x + W + 10, lx + 14);
      g.quadraticCurveTo(x + W, lx + 8, x + W - 8, lx + 4); g.closePath(); g.fill();
    };
    // top pipe: cup di bawah → flip=false dengan h termasuk cup bawah
    const H = 600;
    let c = this._c(W, H), g = c.getContext('2d');
    body(g, 0, 0, H, false); // cup di bawah
    this.pipeBot = c;
    c = this._c(W, H); g = c.getContext('2d');
    body(g, 0, 0, H, true);  // cup di atas
    this.pipeTop = c;
  },

  _rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
};
