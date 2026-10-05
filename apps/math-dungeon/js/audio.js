/* Math Dungeon — WebAudio procedural SFX + chiptune loop. No external assets. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});
  let ctx = null, master = null, musicGain = null, musicTimer = null, musicOn = true, soundOn = true, unlocked = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    return ctx;
  }

  function tone(freq, o) {
    if (!soundOn) return; const c = ensure(); if (!c) return;
    o = o || {};
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + o.slide), t0 + (o.dur || 0.15));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + (o.dur || 0.15) + 0.02);
  }
  function noise(dur, vol, f0, f1, delay) {
    if (!soundOn) return; const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  const SFX = {
    button: () => tone(660, { type: 'square', dur: 0.07, vol: 0.18 }),
    step: i => tone(300 + ((i || 0) % 2) * 60, { type: 'triangle', dur: 0.05, vol: 0.09 }),
    sword: () => { noise(0.12, 0.3, 3000, 600); tone(180, { type: 'sawtooth', dur: 0.1, vol: 0.2, slide: -120 }); },
    magic: () => { tone(520, { type: 'sine', dur: 0.3, vol: 0.25, slide: 640 }); noise(0.25, 0.12, 1200, 4000); },
    enemyHit: () => { tone(220, { type: 'square', dur: 0.09, vol: 0.22, slide: -140 }); noise(0.08, 0.2, 900, 300); },
    playerHit: () => { tone(140, { type: 'sawtooth', dur: 0.22, vol: 0.3, slide: -80 }); },
    correct: () => { tone(660, { dur: 0.09, vol: 0.2 }); tone(880, { dur: 0.12, vol: 0.2, delay: 0.09 }); },
    wrong: () => { tone(220, { type: 'sawtooth', dur: 0.25, vol: 0.22, slide: -90 }); tone(164, { type: 'square', dur: 0.3, vol: 0.12, delay: 0.05 }); },
    coin: () => { tone(1320, { dur: 0.06, vol: 0.16 }); tone(1760, { dur: 0.1, vol: 0.16, delay: 0.06 }); },
    chest: () => { noise(0.2, 0.2, 500, 2000); [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.16, vol: 0.2, delay: i * 0.09 })); },
    levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'square', dur: 0.14, vol: 0.18, delay: i * 0.08 })); },
    bossDown: () => { noise(0.5, 0.35, 1500, 120); [392, 330, 262, 196].forEach((f, i) => tone(f, { type: 'sawtooth', dur: 0.22, vol: 0.2, delay: i * 0.12 })); [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.2, vol: 0.2, delay: 0.5 + i * 0.1 })); },
    door: () => { noise(0.3, 0.25, 300, 90); tone(90, { type: 'triangle', dur: 0.3, vol: 0.2, slide: 40 }); },
    heal: () => { [440, 554, 659].forEach((f, i) => tone(f, { type: 'sine', dur: 0.25, vol: 0.2, delay: i * 0.1 })); },
    power: () => { noise(0.35, 0.35, 2500, 300); [880, 1174, 1568].forEach((f, i) => tone(f, { type: 'square', dur: 0.15, vol: 0.22, delay: i * 0.07 })); },
    start: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.18, vol: 0.22, delay: i * 0.1 })); noise(0.4, 0.12, 400, 3000); }
  };

  // ---- dungeon chiptune loop (minor, adventurous) ----
  const BASS = [110, 110, 131, 110, 98, 98, 131, 147];
  const LEAD = [440, 0, 523, 440, 0, 392, 440, 0, 349, 392, 440, 0, 523, 0, 440, 0];
  let step = 0;
  function musicTick() {
    if (!musicOn || !ctx) return;
    const c = ctx, t = c.currentTime;
    const b = BASS[(step >> 1) % BASS.length];
    if (step % 2 === 0) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = b;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.4);
    }
    const l = LEAD[step % LEAD.length];
    if (l) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = l;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.25);
    }
    step++;
  }
  function startMusic() {
    ensure();
    if (musicTimer) return;
    musicTimer = setInterval(musicTick, 240);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  MD.Audio = {
    unlock: () => { ensure(); },
    play: name => { if (SFX[name]) SFX[name](); },
    setSound: on => { soundOn = on; },
    setMusic: on => { musicOn = on; if (on && unlocked) startMusic(); else stopMusic(); },
    startMusic, stopMusic,
    get soundOn() { return soundOn; },
    get musicOn() { return musicOn; }
  };
})(window);
