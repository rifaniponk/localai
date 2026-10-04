/* ============================================================
   audio.js — Voice input (mic RMS + noise-gate kalibrasi)
   dan SFX sintet (WebAudio, tanpa file audio eksternal)
   ============================================================ */
'use strict';

class VoiceInput {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.ready = false;
    this.noiseFloor = 0.01;   // level ambien (kalibrasi otomatis)
    this.gate = 0.035;        // ambang minimum "teriak" (efektif di atas noise floor)
    this.smooth = 0;          // level ter-smooth 0..1
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.4;
    src.connect(this.analyser);
    this.data = new Float32Array(this.analyser.fftSize);
    this.ready = true;
    this._calibrate();
  }

  /* Kalibrasi noise floor: sampling level saat 1.2 detik pertama. */
  _calibrate() {
    let samples = [], t0 = performance.now();
    const tick = () => {
      const v = this._raw();
      samples.push(v);
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
      else {
        samples.sort((a, b) => a - b);
        const p60 = samples[Math.floor(samples.length * 0.6)] || 0.005;
        this.noiseFloor = Math.min(0.03, Math.max(0.004, p60));
        this.gate = Math.max(0.03, this.noiseFloor * 2.2);
      }
    };
    tick();
  }

  _raw() {
    if (!this.ready) return 0;
    this.analyser.getFloatTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i] * this.data[i];
    return Math.sqrt(sum / this.data.length); // RMS 0..1
  }

  /* level() → 0..1 sudah dikalibrasi terhadap noise floor. */
  level() {
    const raw = this._raw();
    let v = (raw - this.noiseFloor) / (0.35 - this.noiseFloor); // 0.35 RMS ≈ teriakan penuh
    v = Math.max(0, Math.min(1, v));
    this.smooth = this.smooth * 0.55 + v * 0.45;
    return this.smooth;
  }
}

/* ---------- SFX sintet ---------- */
class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  _env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  /* whoosh flap — pitch & volume mengikuti intensitas suara */
  flap(intensity) {
    this.ensure();
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220 + intensity * 340, t);
    o.frequency.exponentialRampToValueAtTime(120 + intensity * 160, t + 0.16);
    this._env(g, t, 0.01, 0.16, 0.05 + intensity * 0.16);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.2);
  }
  /* suara "teriakan" bird — formant sederhana */
  scream(intensity) {
    this.ensure();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(500 + intensity * 700, t);
    o.frequency.linearRampToValueAtTime(300 + intensity * 500, t + 0.25);
    o2.frequency.setValueAtTime(250 + intensity * 350, t);
    this._env(g, t, 0.02, 0.24, 0.02 + intensity * 0.05);
    o.connect(g); o2.connect(g); g.connect(this.ctx.destination);
    o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
  }
  milestone() {
    this.ensure();
    const t = this.ctx.currentTime;
    [660, 880, 1100].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      this._env(g, t + i * 0.07, 0.01, 0.14, 0.09);
      o.connect(g).connect(this.ctx.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
    });
  }
  hit() {
    this.ensure();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    this._env(g, t, 0.005, 0.45, 0.22);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.5);
  }
  beep(high) {
    this.ensure();
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = high ? 880 : 520;
    this._env(g, t, 0.01, 0.12, 0.1);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.18);
  }
}
