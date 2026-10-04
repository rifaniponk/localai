/* localai landing — "the machine"
   all sound is synthesized live with WebAudio (no audio files).
   background is a live neural-net canvas (no image assets). */
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ AUDIO ENGINE (synth, zero assets) ============ */
  let ac = null, master = null, hum = null, soundOn = false;

  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.0;
      master.connect(ac.destination);
    }
    return ac;
  }

  function startHum() {
    const ctx = audio();
    hum = { osc: [], stop() { this.osc.forEach(o => { try { o.stop(); } catch {} }); } };
    // deep machine hum: two detuned saws through a lowpass
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 140; filt.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0.05;
    [55, 55.7, 110.3].forEach(f => {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      o.connect(filt); o.start(); hum.osc.push(o);
    });
    // slow LFO on filter = breathing machine
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 60;
    lfo.connect(lg); lg.connect(filt.frequency); lfo.start(); hum.osc.push(lfo);
    filt.connect(g); g.connect(master);
  }

  function blip(freq = 880, dur = 0.08, type = "square", vol = 0.12) {
    if (!soundOn || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }

  function sweep(up = true) {
    if (!soundOn || !ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(up ? 120 : 900, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(up ? 900 : 120, ac.currentTime + 0.5);
    g.gain.setValueAtTime(0.08, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.55);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime + 0.6);
  }

  const soundBtn = document.getElementById("sound");
  function setSound(on) {
    soundOn = on;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.querySelector("span").textContent = on ? "ON" : "OFF";
    if (on) {
      audio().resume();
      if (!hum) startHum();
      master.gain.linearRampToValueAtTime(0.9, ac.currentTime + 0.4);
      blip(660, 0.06); setTimeout(() => blip(990, 0.08), 90);
    } else if (master) {
      master.gain.linearRampToValueAtTime(0.0, ac.currentTime + 0.3);
    }
  }
  soundBtn.addEventListener("click", () => setSound(!soundOn));

  /* ============ BOOT OVERLAY ============ */
  const boot = document.getElementById("boot");
  const bootlines = document.getElementById("bootlines");
  const BOOT_MSGS = [
    "> init qwen3.8-flash-next ............ OK",
    "> load iq3 weights (local only) ..... OK",
    "> hermes agent handshake ............ OK",
    "> scanning apps/*/app.json .......... 1 FOUND",
    "> cloud api calls ................... 0",
    "> machine ready."
  ];
  let mi = 0;
  const typer = setInterval(() => {
    if (mi >= BOOT_MSGS.length) { clearInterval(typer); return; }
    const d = document.createElement("div");
    d.textContent = BOOT_MSGS[mi++];
    bootlines.appendChild(d);
    if (soundOn) blip(440 + mi * 80, 0.05, "square", 0.06);
  }, reduced ? 60 : 320);

  document.getElementById("bootbtn").addEventListener("click", () => {
    setSound(true);          // boot = sound on
    sweep(true);
    boot.classList.add("gone");
    setTimeout(() => { boot.remove(); scrambleAll(); }, 650);
  });

  /* ============ SCRAMBLE TEXT ============ */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01<>/\\*#$%&";
  function scramble(el, delay = 0) {
    const target = el.dataset.text;
    if (reduced) { el.textContent = target; return; }
    let frame = 0;
    const total = target.length * 3 + 20;
    setTimeout(() => {
      const iv = setInterval(() => {
        frame++;
        let out = "";
        for (let i = 0; i < target.length; i++) {
          if (target[i] === " ") { out += " "; continue; }
          const reveal = frame - i * 3;
          out += reveal > 0 ? target[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (frame > total) { clearInterval(iv); el.textContent = target; blip(1200, 0.05, "sine", 0.05); }
      }, 35);
    }, delay);
  }
  function scrambleAll() {
    document.querySelectorAll(".scramble").forEach((el, i) => scramble(el, i * 260));
  }

  /* ============ NEURAL NET CANVAS ============ */
  const cv = document.getElementById("net");
  const cx = cv.getContext("2d");
  let W, H, nodes = [], mouse = { x: -999, y: -999 };

  function resize() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    const n = Math.min(90, Math.floor((W * H) / 22000));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.6 + .6,
      sig: Math.random()          // signal phase
    }));
  }
  addEventListener("resize", resize); resize();
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  let t = 0;
  function draw() {
    t += 0.016;
    cx.clearRect(0, 0, W, H);
    // connections
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16000) {
          const alpha = (1 - d2 / 16000) * 0.14;
          cx.strokeStyle = `rgba(158,245,76,${alpha})`;
          cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
          // travelling signal pulse on some links
          if ((i + j) % 7 === 0) {
            const p = (t * 0.5 + a.sig) % 1;
            cx.fillStyle = "rgba(158,245,76,.5)";
            cx.beginPath();
            cx.arc(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, 1.4, 0, 7);
            cx.fill();
          }
        }
      }
      // mouse attraction glow
      const mdx = a.x - mouse.x, mdy = a.y - mouse.y;
      const md2 = mdx * mdx + mdy * mdy;
      if (md2 < 22000) {
        cx.strokeStyle = `rgba(245,185,76,${(1 - md2 / 22000) * .35})`;
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mouse.x, mouse.y); cx.stroke();
      }
    }
    // nodes
    for (const a of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + a.sig * 6.28);
      cx.fillStyle = `rgba(158,245,76,${0.25 + pulse * 0.4})`;
      cx.beginPath(); cx.arc(a.x, a.y, a.r + pulse * 0.6, 0, 7); cx.fill();
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  if (reduced) draw(); else requestAnimationFrame(draw);

  /* ============ SCROLL REVEAL ============ */
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
        if (soundOn) blip(520 + Math.random() * 300, 0.05, "sine", 0.05);
      }
    });
  }, { threshold: 0.15 });

  /* ============ COUNTER ============ */
  const counter = document.querySelector(".bignum");
  const cio = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    cio.disconnect();
    // counts to zero. dramatic. it was always zero.
    let n = 128;
    const iv = setInterval(() => {
      n = Math.max(0, n - Math.ceil(n / 8));
      counter.textContent = n;
      if (n === 0) { clearInterval(iv); counter.textContent = "0"; sweep(false); }
    }, 90);
  }, { threshold: 0.5 });
  cio.observe(counter);

  /* ============ CATALOG FROM MANIFEST ============ */
  fetch("manifest.json", { cache: "no-store" })
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(({ apps }) => {
      const grid = document.getElementById("grid");
      if (!apps.length) { grid.innerHTML = '<p class="empty">// manifest empty — the machine is thinking.</p>'; return; }
      grid.innerHTML = apps.map((a, i) => `
        <a class="card" href="${a.slug}/">
          <span class="num">APP_${String(i + 1).padStart(3, "0")}</span>
          <h3>${a.name}</h3>
          <p>${a.description}</p>
          <div class="meta">
            <span class="tag">${a.stack}</span>
            <span class="tag ${a.status}">${a.status}</span>
            <span class="tag">${a.created || ""}</span>
          </div>
          <span class="go">RUN →</span>
        </a>`).join("");
      grid.querySelectorAll(".card").forEach((c, i) => {
        setTimeout(() => { c.classList.add("in"); if (soundOn) blip(700 + i * 120, 0.06, "sine", 0.07); }, 150 + i * 180);
        io.observe(c);
        c.addEventListener("pointermove", e => {
          const r = c.getBoundingClientRect();
          c.style.setProperty("--mx", (e.clientX - r.left) + "px");
          c.style.setProperty("--my", (e.clientY - r.top) + "px");
        });
        c.addEventListener("pointerenter", () => blip(880, 0.04, "sine", 0.05));
        c.addEventListener("click", () => sweep(true));
      });
    })
    .catch(() => {
      document.getElementById("grid").innerHTML =
        '<p class="empty">// manifest.json unreachable — the machine is asleep.</p>';
    });

  document.querySelectorAll(".specs li").forEach(li => io.observe(li));
  document.getElementById("year").textContent = new Date().getFullYear();
})();
