// audio.js — pure WebAudio chiptune SFX (zero external assets)
(function () {
  'use strict';
  let ctx = null, master = null;
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, o) {
    o = o || {};
    const c = ac(), t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + o.slide), t + (o.dur || 0.15));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.15));
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + (o.dur || 0.15) + 0.05);
  }
  function noise(dur, vol, f0, f1, delay) {
    const c = ac(), t = c.currentTime + (delay || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  const cues = {
    unlock() { ac(); },
    blip(i) { tone(392 * Math.pow(2, (i || 0) / 12), { type: 'square', dur: 0.07, vol: 0.12 }); },
    select() { tone(660, { type: 'square', dur: 0.06, vol: 0.14 }); },
    correct() { [523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.16, vol: 0.2, delay: i * 0.07 })); noise(0.25, 0.06, 4000, 9000, 0.05); },
    wrong() { tone(220, { type: 'sawtooth', dur: 0.28, vol: 0.2, slide: -120 }); tone(110, { type: 'square', dur: 0.3, vol: 0.14, delay: 0.05 }); noise(0.2, 0.1, 1200, 300); },
    tick() { tone(980, { type: 'square', dur: 0.04, vol: 0.08 }); },
    urgent() { tone(1180, { type: 'square', dur: 0.09, vol: 0.16 }); tone(880, { type: 'square', dur: 0.09, vol: 0.14, delay: 0.11 }); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.14, vol: 0.2, delay: i * 0.08 })); noise(0.4, 0.08, 600, 5000); },
    finish() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.22, vol: 0.22, delay: i * 0.1 })); noise(0.6, 0.09, 3000, 10000, 0.1); }
  };
  window.SFX = cues;
})();
