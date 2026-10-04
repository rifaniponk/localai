/* ============================================================
   game.js — engine: fisika suara, endless pipes, skor jarak
   ============================================================ */
'use strict';

class Game {
  constructor(canvas, sfx) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.sfx = sfx;
    // resolusi logis portrait
    this.W = 480; this.H = 760;
    this.groundH = 96;
    this.state = 'menu'; // menu | countdown | playing | dead
    this.onState = null; // callback UI
    this.best = parseInt(localStorage.getItem('screambird.best') || '0', 10);
    this.particles = [];
    this.clouds = [];
    this._initClouds();
  }

  _initClouds() {
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * this.W, y: 30 + Math.random() * 240,
        v: 8 + Math.random() * 14, img: i % 3, s: 0.6 + Math.random() * 0.7
      });
    }
  }

  resize() {
    const stage = this.canvas.parentElement;
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const scale = Math.min(vw / this.W, vh / this.H);
    const w = Math.round(this.W * scale), h = Math.round(this.H * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.scale = scale * dpr;
  }

  /* ---------- state machine ---------- */
  toMenu() { this.state = 'menu'; this._reset(); this.onState && this.onState('menu'); }

  startCountdown() {
    this._reset();
    this.state = 'countdown';
    this.cdT = 3.0;
    this.onState && this.onState('countdown');
  }

  _reset() {
    this.bird = { x: this.W * 0.3, y: this.H * 0.42, vy: 0, rot: 0, frame: 0, flapT: 0, screaming: 0 };
    this.pipes = [];
    this.particles = [];
    this.dist = 0;          // px
    this.speed = 170;       // px/s
    this.spawnT = 1.2;
    this.shake = 0;
    this.flash = 0;
    this.nextMilestone = 100;
    this.lastFlapAt = -1;
    this.voiceLevel = 0;
  }

  die() {
    this.state = 'dead';
    this.sfx.hit();
    this.shake = 14;
    // bulu beterbangan
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        type: 'feather', x: this.bird.x, y: this.bird.y,
        vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, life: 1.4
      });
    }
    const m = this.meters();
    this.newBest = m > this.best;
    if (this.newBest) { this.best = m; localStorage.setItem('screambird.best', String(m)); }
    setTimeout(() => this.onState && this.onState('dead'), 700);
  }

  meters() { return Math.floor(this.dist / 12); }

  /* ---------- update ---------- */
  update(dt, level) {
    this.voiceLevel = level;

    // awan selalu jalan (semua state)
    for (const c of this.clouds) {
      c.x -= c.v * dt;
      if (c.x < -240) { c.x = this.W + 60; c.y = 30 + Math.random() * 240; }
    }

    if (this.state === 'countdown') {
      const prev = Math.ceil(this.cdT);
      this.cdT -= dt;
      const now = Math.ceil(this.cdT);
      if (now !== prev && now > 0) this.sfx.beep(false);
      if (this.cdT <= 0) {
        this.state = 'playing';
        this.sfx.beep(true);
        this.onState && this.onState('playing');
      }
      // bird idle melayang
      this.bird.y = this.H * 0.42 + Math.sin(performance.now() / 300) * 8;
      this._animWing(dt, 0.35);
      return;
    }

    if (this.state !== 'playing') {
      if (this.state === 'dead') {
        this.bird.vy += 1500 * dt;
        this.bird.y += this.bird.vy * dt;
        this.bird.rot = Math.min(this.bird.rot + 5 * dt, Math.PI / 2);
        if (this.bird.y > this.H - this.groundH - 20) {
          this.bird.y = this.H - this.groundH - 20; this.bird.vy = 0;
        }
        this._updateParticles(dt);
        this.shake = Math.max(0, this.shake - 40 * dt);
      }
      return;
    }

    /* ---- difficulty ramp (endless) ---- */
    const m = this.meters();
    const ramp = Math.min(1, m / 900);
    this.speed = 170 + ramp * 150;          // 170 → 320 px/s
    const gap = 235 - ramp * 85;           // 235 → 150 px
    const spacing = 300 - ramp * 60;       // 300 → 240 px

    /* ---- VOICE FLAP: makin keras → impuls makin kuat ---- */
    const GATE = 0.12;
    if (level > GATE && performance.now() - this.lastFlapAt > 240) {
      const power = 320 + level * 620;     // impuls 320..940 px/s
      this.bird.vy = -power;
      this.lastFlapAt = performance.now();
      this.bird.screaming = level > 0.45 ? 0.35 : 0;
      this.sfx.flap(level);
      if (level > 0.55) this.sfx.scream(level);
      // burst partikel udara
      for (let i = 0; i < 3 + level * 6; i++) {
        this.particles.push({
          type: 'puff', x: this.bird.x - 20, y: this.bird.y + 8,
          vx: -60 - Math.random() * 80, vy: 30 + Math.random() * 60,
          r: 3 + Math.random() * 5, life: 0.5
        });
      }
    }
    this.bird.screaming = Math.max(0, this.bird.screaming - dt);

    /* ---- fisika ---- */
    this.bird.vy += 1650 * dt;
    this.bird.vy = Math.min(this.bird.vy, 780);
    this.bird.y += this.bird.vy * dt;
    const targetRot = Math.max(-0.5, Math.min(1.35, this.bird.vy / 620));
    this.bird.rot += (targetRot - this.bird.rot) * Math.min(1, 10 * dt);
    this._animWing(dt, Math.abs(this.bird.vy) / 500 + 0.4);

    // langit-langit
    if (this.bird.y < 10) { this.bird.y = 10; this.bird.vy = Math.max(this.bird.vy, 0); }
    // tanah
    if (this.bird.y + 20 > this.H - this.groundH) { this.bird.y = this.H - this.groundH - 20; this.die(); return; }

    /* ---- pipes ---- */
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = spacing / this.speed;
      const minY = 110 + gap / 2, maxY = this.H - this.groundH - 110 - gap / 2;
      const cy = minY + Math.random() * (maxY - minY);
      this.pipes.push({ x: this.W + 40, cy, gap, passed: false });
    }
    for (const p of this.pipes) p.x -= this.speed * dt;
    this.pipes = this.pipes.filter(p => p.x > -140);

    // tabrakan (AABB vs bird ellipse → pakai box kecil)
    const bx = this.bird.x, by = this.bird.y, br = 17;
    for (const p of this.pipes) {
      if (bx + br < p.x || bx - br > p.x + Assets.pipeW) continue;
      const topH = p.cy - p.gap / 2, botY = p.cy + p.gap / 2;
      if (by - br < topH || by + br > botY) { this.die(); return; }
    }

    /* ---- skor jarak + milestone ---- */
    this.dist += this.speed * dt;
    if (m >= this.nextMilestone) {
      this.flash = 0.35;
      this.sfx.milestone();
      this.nextMilestone += 100;
      this.onState && this.onState('milestone', m);
    }

    // speed lines
    if (Math.random() < ramp * 0.5) {
      this.particles.push({
        type: 'line', x: this.W, y: Math.random() * (this.H - this.groundH),
        vx: -this.speed * 1.6, vy: 0, len: 20 + Math.random() * 40, life: 0.6
      });
    }

    this._updateParticles(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.shake = Math.max(0, this.shake - 40 * dt);
  }

  pipeL() { return this.bird.x - 17; } // batas kiri cek (bird x - r)

  _animWing(dt, rate) {
    this.bird.flapT += dt * (4 + rate * 9);
    this.bird.frame = Math.floor(this.bird.flapT) % 6;
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.type === 'feather') { p.vy += 300 * dt; p.rot += p.vr * dt; }
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /* ---------- render ---------- */
  render() {
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.shake > 0) g.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);

    // langit gradasi
    const sky = g.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0, '#4fb7ef'); sky.addColorStop(0.6, '#a8dcf5'); sky.addColorStop(1, '#e8f6c9');
    g.fillStyle = sky; g.fillRect(-20, -20, this.W + 40, this.H + 40);

    // matahari
    g.fillStyle = 'rgba(255,240,180,.9)';
    g.beginPath(); g.arc(this.W - 80, 90, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,240,180,.25)';
    g.beginPath(); g.arc(this.W - 80, 90, 58, 0, Math.PI * 2); g.fill();

    const scroll = this.dist;
    // parallax: mountain 0.1, skyline 0.25, hill 0.5, ground 1.0
    this._tile(Assets.mountain, scroll * 0.10, this.H - this.groundH - Assets.mountain.height + 30);
    this._tile(Assets.skyline, scroll * 0.25, this.H - this.groundH - Assets.skyline.height + 10);
    this._tile(Assets.hill, scroll * 0.5, this.H - this.groundH - Assets.hill.height + 6);

    // awan
    for (const c of this.clouds) {
      g.save(); g.translate(c.x, c.y); g.scale(c.s, c.s);
      g.drawImage(Assets.cloud[c.img], -110, -45); g.restore();
    }

    // pipes
    for (const p of this.pipes) {
      const topH = p.cy - p.gap / 2, botY = p.cy + p.gap / 2;
      // pipeTop: gambar bagian bawah setinggi topH → crop
      g.drawImage(Assets.pipeTop, 0, Assets.pipeTop.height - topH, Assets.pipeW, topH,
        p.x, 0, Assets.pipeW, topH);
      const botH = this.H - this.groundH - botY;
      if (botH > 0) g.drawImage(Assets.pipeBot, 0, 0, Assets.pipeW, botH, p.x, botY, Assets.pipeW, botH);
    }

    // ground
    this._tile(Assets.ground, scroll, this.H - this.groundH);

    // particles
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.type === 'puff') {
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      } else if (p.type === 'line') {
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.len, p.y); g.stroke();
      } else { // feather
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = '#ffcf5e';
        g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;

    // bird
    const b = this.bird;
    g.save();
    g.translate(b.x, b.y); g.rotate(b.rot);
    const img = b.screaming > 0 ? Assets.bird.scream : Assets.bird.frames[b.frame];
    g.drawImage(img, -Assets.birdW / 2, -Assets.birdH / 2);
    g.restore();

    // flash milestone
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.8})`;
      g.fillRect(-20, -20, this.W + 40, this.H + 40);
    }
  }

  _tile(img, scroll, y) {
    const g = this.g, w = img.width;
    let off = -(scroll % w);
    for (let x = off; x < this.W; x += w) g.drawImage(img, x, y);
  }
}
