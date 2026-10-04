/* localai landing — "ARCADE"
   chiptune BGM + SFX synthesized live with WebAudio (no audio files).
   starfield canvas background (no image assets).
   gallery cards render thumbnails from apps/<slug>/<thumb>. */
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============ AUDIO ENGINE: chiptune synth, zero assets ============ */
  let ac = null, master = null, musicOn = false, seqTimer = null;

  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.0;
      master.connect(ac.destination);
    }
    return ac;
  }

  // square-wave lead + triangle bass, 8-step loop — classic chiptune feel
  const LEAD = [523, 0, 659, 784, 0, 659, 587, 523, 494, 587, 659, 0, 587, 523, 0, 440];
  const BASS = [131, 0, 131, 0, 165, 0, 165, 0, 123, 0, 123, 0, 110, 0, 147, 0];
  let step = 0;

  function note(freq, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }

  function startSeq() {
    if (seqTimer) return;
    seqTimer = setInterval(() => {
      if (!musicOn || !ac) return;
      const l = LEAD[step % LEAD.length], b = BASS[step % BASS.length];
      if (l) note(l, 0.14, "square", 0.05);
      if (b) note(b, 0.22, "triangle", 0.09);
      if (step % 4 === 0) note(60 + (step % 8) * 2, 0.05, "square", 0.02); // hat-ish tick
      step++;
    }, 150);
  }

  function blip(freq = 880, dur = 0.08, type = "square", vol = 0.12) {
    if (!musicOn || !ac) return;
    note(freq, dur, type, vol);
  }

  function coinSound() {
    if (!musicOn || !ac) return;
    note(988, 0.07, "square", 0.12);
    setTimeout(() => note(1319, 0.16, "square", 0.12), 70);
  }

  function powerChord() {
    if (!musicOn || !ac) return;
    [262, 330, 392, 523].forEach((f, i) => setTimeout(() => note(f, 0.25, "square", 0.08), i * 90));
  }

  const soundBtn = document.getElementById("sound");
  function setMusic(on) {
    musicOn = on;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.querySelector("span").textContent = on ? "ON" : "OFF";
    if (on) {
      audio().resume();
      startSeq();
      master.gain.linearRampToValueAtTime(0.9, ac.currentTime + 0.4);
      coinSound();
    } else if (master) {
      master.gain.linearRampToValueAtTime(0.0, ac.currentTime + 0.3);
    }
  }
  soundBtn.addEventListener("click", () => setMusic(!musicOn));

  // first user gesture anywhere enables music (arcade cabinets are never silent)
  let armed = false;
  addEventListener("pointerdown", () => {
    if (armed || musicOn) return;
    armed = true;
    setMusic(true);
  }, { once: true });

  /* ============ STARFIELD CANVAS ============ */
  const cv = document.getElementById("stars");
  const cx = cv.getContext("2d");
  let W, H, stars = [], shoot = null;

  function resize() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    const n = Math.min(160, Math.floor((W * H) / 9000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: Math.random() * 0.8 + 0.2,
      tw: Math.random() * 6.28
    }));
  }
  addEventListener("resize", resize); resize();

  let t = 0;
  function draw() {
    t += 0.016;
    cx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.y += s.z * 0.35;                       // slow drift down
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.5 + s.tw));
      const size = s.z * 1.8;
      // occasional colored "arcade pixel" star
      cx.fillStyle = s.tw > 5.6 ? `rgba(255,46,136,${a})`
                   : s.tw > 5.0 ? `rgba(38,229,255,${a})`
                   : `rgba(239,234,255,${a * 0.8})`;
      cx.fillRect(s.x | 0, s.y | 0, Math.ceil(size), Math.ceil(size));
    }
    // shooting star every few seconds
    if (!shoot && Math.random() < 0.004) {
      shoot = { x: Math.random() * W * 0.7, y: Math.random() * H * 0.3, vx: 7, vy: 3, life: 1 };
    }
    if (shoot) {
      shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.02;
      cx.strokeStyle = `rgba(255,210,63,${shoot.life})`;
      cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(shoot.x, shoot.y);
      cx.lineTo(shoot.x - shoot.vx * 8, shoot.y - shoot.vy * 8); cx.stroke();
      if (shoot.life <= 0) shoot = null;
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
      }
    });
  }, { threshold: 0.12 });

  /* ============ GALLERY FROM MANIFEST (with thumbnails) ============ */
  fetch("manifest.json", { cache: "no-store" })
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(({ apps }) => {
      const grid = document.getElementById("grid");
      if (!apps.length) {
        grid.innerHTML = '<p class="empty">INSERT COIN — NO CARTRIDGES DETECTED</p>';
        return;
      }
      grid.innerHTML = apps.map((a, i) => `
        <a class="card" href="${a.slug}/" aria-label="Play ${a.name}">
          <div class="screen">
            <span class="led ${a.status === "draft" ? "draft" : ""}"></span>
            ${a.thumb
              ? `<img src="${a.slug}/${a.thumb}" alt="${a.name} screenshot" loading="lazy">`
              : `<span class="nothumb">NO SIGNAL</span>`}
          </div>
          <div class="slot">
            <h3>${a.name}</h3>
            <span class="play">▶ PLAY</span>
          </div>
          <p>${a.description}</p>
          <div class="tags">
            <span class="tag">${a.stack}</span>
            <span class="tag ${a.status}">${a.status}</span>
            <span class="tag">${a.created || ""}</span>
          </div>
        </a>`).join("");

      grid.querySelectorAll(".card").forEach((c, i) => {
        setTimeout(() => {
          c.classList.add("in");
          blip(660 + i * 110, 0.07, "square", 0.06);
        }, 120 + i * 160);
        io.observe(c);
        c.addEventListener("pointerenter", () => blip(990, 0.04, "square", 0.05));
        c.addEventListener("click", () => coinSound());
      });

      // broken thumbnail -> NO SIGNAL fallback
      grid.querySelectorAll(".screen img").forEach(img => {
        img.addEventListener("error", () => {
          img.replaceWith(Object.assign(document.createElement("span"),
            { className: "nothumb", textContent: "NO SIGNAL" }));
        });
      });
    })
    .catch(() => {
      document.getElementById("grid").innerHTML =
        '<p class="empty">GAME OVER — manifest.json unreachable</p>';
    });

  document.getElementById("year").textContent = new Date().getFullYear();

  // welcome chord once fonts settled (silent until user gesture — browsers require it)
  addEventListener("load", () => { if (musicOn) powerChord(); });
})();
