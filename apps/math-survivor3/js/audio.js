/* ============================================================
   Audio — procedural WebAudio: SFX bank + generative ambient score
   ============================================================ */

const Audio = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let vol = 0.8;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      return true;
    } catch (e) { return false; }
  }
  const now = () => ctx.currentTime;

  function env(node, t0, a, d, peak = 1) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function tone({ freq = 440, type = 'sine', a = 0.005, d = 0.2, peak = 0.5, detune = 0, bus = master, t0 = null }) {
    if (!ensure()) return;
    const t = t0 ?? now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(g); g.connect(bus);
    env(g, t, a, d, peak);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }

  function noise({ d = 0.2, peak = 0.4, low = false, bus = master, t0 = null, sweep = null }) {
    if (!ensure()) return;
    const t = t0 ?? now();
    const len = Math.max(1, Math.floor(ctx.sampleRate * d));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    let node = src;
    if (low) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(bus);
    env(g, t, 0.004, d, peak);
    if (sweep) {
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 2;
      f2.frequency.setValueAtTime(sweep.from, t);
      f2.frequency.exponentialRampToValueAtTime(sweep.to, t + d);
      g.disconnect(); g.connect(f2); f2.connect(bus);
    }
    src.start(t); src.stop(t + d + 0.1);
  }

  /* ---------------- SFX bank ---------------- */

  const fx = {
    laser() {
      if (!ensure()) return;
      const t = now();
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.22);
      f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = 1200;
      o.connect(f); f.connect(g); g.connect(master);
      env(g, t, 0.004, 0.24, 0.4);
      o.start(t); o.stop(t + 0.3);
    },
    impact() {
      noise({ d: 0.3, peak: 0.55, sweep: { from: 2400, to: 220 } });
      tone({ freq: 90, type: 'sine', d: 0.28, peak: 0.7 });
    },
    chime(streak) {
      const base = 660 * Math.pow(1.06, Math.min(streak, 14));
      [0, 4, 7].forEach((semi, i) =>
        tone({ freq: base * Math.pow(2, semi / 12), type: 'triangle',
               d: 0.5, peak: 0.18, t0: now() + i * 0.055 }));
    },
    fizzle() {
      noise({ d: 0.25, peak: 0.3, low: true });
      tone({ freq: 160, type: 'square', d: 0.16, peak: 0.16 });
    },
    hurt() {
      tone({ freq: 220, type: 'sawtooth', d: 0.3, peak: 0.5 });
      tone({ freq: 110, type: 'square', d: 0.34, peak: 0.4 });
      noise({ d: 0.2, peak: 0.4, low: true });
    },
    horn() {
      const t = now();
      [196, 246.9, 293.7].forEach((f, i) =>
        tone({ freq: f, type: 'sawtooth', a: 0.03, d: 1.1, peak: 0.16, t0: t + i * 0.07 }));
      tone({ freq: 98, type: 'sine', a: 0.02, d: 1.3, peak: 0.4 });
    },
    bossSting() {
      const t = now();
      [65.4, 98, 130.8, 155.6].forEach((f, i) =>
        tone({ freq: f, type: 'sawtooth', a: 0.05, d: 1.8, peak: 0.22, t0: t + i * 0.12 }));
      noise({ d: 1.2, peak: 0.2, low: true });
    },
    nova() {
      const t = now();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(60, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.5);
      o.connect(g); g.connect(master);
      env(g, t, 0.01, 0.6, 0.6);
      o.start(t); o.stop(t + 0.7);
      noise({ d: 0.7, peak: 0.5, sweep: { from: 200, to: 4000 } });
    },
    dash() { noise({ d: 0.16, peak: 0.25, sweep: { from: 400, to: 2400 } }); },
    click() { tone({ freq: 900, type: 'triangle', d: 0.06, peak: 0.2 }); },
    boon() {
      const t = now();
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', d: 0.7, peak: 0.22, t0: t + i * 0.09 }));
    },
    gameover() {
      const t = now();
      [392, 311, 261, 196].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', a: 0.02, d: 0.9, peak: 0.25, t0: t + i * 0.22 }));
      noise({ d: 1.4, peak: 0.25, low: true });
    },
  };

  /* ---------------- generative ambient score ---------------- */
  /* slow minor arpeggio over a drone, changes root every 8 bars */

  const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
  const ROOTS = [55, 61.7, 65.4, 73.4]; // A1 B1 C2 D2-ish

  function startMusic() {
    if (!ensure() || musicTimer) return;
    let rootIdx = Math.floor(Math.random() * ROOTS.length);
    let step = 0;
    const beat = 0.36;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state === 'suspended') return;
      const t = now() + 0.05;
      const root = ROOTS[rootIdx % ROOTS.length];
      // drone every 8 steps
      if (step % 8 === 0)
        tone({ freq: root, type: 'sawtooth', a: 0.3, d: 3.2, peak: 0.05, bus: musicGain, t0: t });
      // arpeggio
      const deg = SCALE[(step * 2 + Math.floor(step / 5)) % SCALE.length];
      const oct = step % 3 === 2 ? 4 : 2;
      tone({
        freq: root * Math.pow(2, oct + deg / 12), type: 'triangle',
        a: 0.01, d: 0.9, peak: 0.028 + 0.01 * Math.random(), detune: Math.random() * 6,
        bus: musicGain, t0: t,
      });
      if (step % 16 === 15) { step = 0; rootIdx++; } else step++;
    }, beat * 1000);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setVolume(v) {
    vol = v;
    if (master) master.gain.value = v;
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { fx, startMusic, stopMusic, setVolume, suspend, resume, ensure, get ctx() { return ctx; } };
})();

export default Audio;
