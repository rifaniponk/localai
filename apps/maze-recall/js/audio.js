/* MAZE RECALL — WebAudio synth SFX (zero external assets) */
const SFX = (() => {
  'use strict';
  let ac = null, master = null;

  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(f, o = {}) {
    const a = ensure();
    const { type = 'sine', dur = 0.15, vol = 0.4, delay = 0, slide = 0, attack = 0.006 } = o;
    const t = ac.currentTime + delay;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  function noise(dur, vol, f0, f1, delay = 0) {
    const a = ensure();
    const t = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = a.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const flt = a.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    start() {
      tone(330, { type: 'triangle', dur: 0.12, vol: 0.4 });
      tone(494, { type: 'triangle', dur: 0.12, vol: 0.4, delay: 0.09 });
      tone(659, { type: 'triangle', dur: 0.22, vol: 0.4, delay: 0.18 });
      noise(0.3, 0.12, 400, 2400, 0.02); // whoosh in
    },
    blip(i) {
      const semi = (i % 10);
      tone(392 * Math.pow(2, semi / 12), { type: 'triangle', dur: 0.09, vol: 0.32 });
    },
    backtrack() { tone(300, { type: 'sine', dur: 0.07, vol: 0.18, slide: -110 }); },
    tick() { tone(980, { type: 'square', dur: 0.05, vol: 0.14 }); },
    go() { tone(660, { type: 'square', dur: 0.12, vol: 0.25, slide: 220 }); },
    error() {
      tone(170, { type: 'sawtooth', dur: 0.5, vol: 0.5, slide: -100 });
      tone(120, { type: 'square', dur: 0.45, vol: 0.28, delay: 0.06, slide: -70 });
      noise(0.4, 0.3, 900, 120);
    },
    clear() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, { type: 'triangle', dur: 0.24, vol: 0.4, delay: i * 0.09 }));
      noise(0.5, 0.1, 600, 3000, 0.05);
    },
    win() {
      [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) =>
        tone(f, { type: 'triangle', dur: 0.3, vol: 0.45, delay: i * 0.13 }));
      noise(0.8, 0.12, 500, 4000, 0.1);
    }
  };
})();
