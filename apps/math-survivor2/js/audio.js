/* Math Survivor — procedural WebAudio SFX. No audio files. Lazy context on first gesture. */
export const Audio = (function () {
  "use strict";
  let ctx = null, master = null, enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, o) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    o = o || {};
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + o.slide), t0 + (o.dur || 0.15));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + (o.dur || 0.15) + 0.02);
  }

  function noise(dur, vol, f0, f1, delay) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "bandpass";
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  const cues = {
    tap(i) { tone(392 * Math.pow(2, ((i || 0) % 8) / 12), { type: "square", dur: 0.06, vol: 0.12 }); },
    enter() { tone(660, { type: "triangle", dur: 0.08, vol: 0.2 }); },
    correct() { tone(523, { type: "triangle", dur: 0.12, vol: 0.3 }); tone(784, { type: "triangle", dur: 0.16, vol: 0.28, delay: 0.07 }); },
    wrong() { tone(196, { type: "sawtooth", dur: 0.18, vol: 0.16, slide: -80 }); noise(0.12, 0.08, 800, 200); },
    shoot() { tone(880, { type: "sine", dur: 0.14, vol: 0.16, slide: 500 }); noise(0.08, 0.05, 2400, 900); },
    impact() { noise(0.22, 0.3, 1200, 120); tone(140, { type: "sine", dur: 0.2, vol: 0.3, slide: -60 }); },
    defeated() { tone(1047, { type: "triangle", dur: 0.1, vol: 0.2 }); tone(1319, { type: "triangle", dur: 0.14, vol: 0.18, delay: 0.06 }); },
    powerup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", dur: 0.14, vol: 0.22, delay: i * 0.06 })); noise(0.4, 0.08, 3000, 6000, 0.1); },
    bomb() { noise(0.6, 0.5, 900, 60); tone(70, { type: "sine", dur: 0.5, vol: 0.5, slide: -30 }); },
    freeze() { noise(0.5, 0.15, 5000, 1200); tone(1568, { type: "sine", dur: 0.4, vol: 0.15, slide: -400 }); },
    lightning() { noise(0.3, 0.35, 4000, 400); tone(2093, { type: "sawtooth", dur: 0.15, vol: 0.12, slide: -1200 }); },
    shield() { tone(392, { type: "sine", dur: 0.3, vol: 0.2, slide: 300 }); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, { type: "sine", dur: 0.18, vol: 0.22, delay: i * 0.08 })); tone(1047, { type: "sine", dur: 0.35, vol: 0.18, delay: 0.24 }); },
    slow() { tone(440, { type: "sine", dur: 0.5, vol: 0.18, slide: -220 }); },
    combo(i) { const f = 659 + 60 * Math.min(8, ((i || 0) % 9)); tone(f, { type: "square", dur: 0.09, vol: 0.14 }); tone(f * 1.5, { type: "square", dur: 0.12, vol: 0.1, delay: 0.05 }); },
    hurt() { tone(220, { type: "sawtooth", dur: 0.25, vol: 0.3, slide: -120 }); noise(0.2, 0.2, 600, 150); },
    bossIn() { tone(98, { type: "sawtooth", dur: 0.6, vol: 0.3, slide: 60 }); tone(147, { type: "square", dur: 0.6, vol: 0.15, delay: 0.15 }); noise(0.8, 0.15, 300, 90); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone(f, { type: "triangle", dur: 0.35, vol: 0.25, delay: i * 0.22 })); },
    highScore() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: "square", dur: 0.16, vol: 0.16, delay: i * 0.09 })); noise(0.5, 0.08, 4000, 8000, 0.3); },
    start() { [392, 523, 659].forEach((f, i) => tone(f, { type: "triangle", dur: 0.14, vol: 0.25, delay: i * 0.08 })); noise(0.3, 0.08, 1500, 4000); }
  };

  function setEnabled(v) { enabled = !!v; if (v) ensure(); }
  function unlock() { ensure(); }

  return { cues, setEnabled, unlock, get enabled() { return enabled; } };
})();
