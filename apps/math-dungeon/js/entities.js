/* Math Dungeon — canvas art: heroes, enemies, bosses, props, particles.
   All vector-style drawing, zero external assets. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});

  // ---------- hero roster ----------
  MD.HEROES = [
    { id: 'knight', name: 'Sir Pixel', blurb: 'Sturdy sword hero', body: '#7d8aa8', accent: '#c9d4ea', weapon: 'sword' },
    { id: 'mage', name: 'Nova', blurb: 'Sparkling spellcaster', body: '#7a5aa8', accent: '#c79fff', weapon: 'staff' },
    { id: 'ranger', name: 'Ivy', blurb: 'Quick bow hero', body: '#4a8a5a', accent: '#a8e0b0', weapon: 'bow' }
  ];

  function shadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Draw a hero at (x,y) feet position. state: idle|walk|attack|hurt|victory, t seconds, face 1|-1
  MD.drawHero = function (ctx, hero, x, y, state, t, face, scale) {
    scale = scale || 1;
    const H = MD.HEROES.find(h => h.id === hero) || MD.HEROES[0];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * scale, scale);
    const breathe = Math.sin(t * 3) * 1.2;
    let bob = 0, lean = 0, armSwing = 0;
    if (state === 'walk') { bob = Math.abs(Math.sin(t * 10)) * -3; armSwing = Math.sin(t * 10) * 0.5; }
    if (state === 'attack') { lean = Math.sin(Math.min(1, t * 6)) * 6; }
    if (state === 'hurt') { lean = -4; }
    if (state === 'victory') { bob = -Math.abs(Math.sin(t * 6)) * 5; }
    shadow(ctx, 0, 0, 16);
    ctx.translate(0, bob);
    ctx.rotate(lean * Math.PI / 180 * 0.4);
    // legs
    ctx.fillStyle = '#2c3245';
    ctx.fillRect(-8, -14, 6, 14); ctx.fillRect(2, -14, 6, 14);
    // body
    ctx.fillStyle = H.body;
    ctx.beginPath(); ctx.roundRect(-11, -34 + breathe * 0.3, 22, 22, 5); ctx.fill();
    // belt
    ctx.fillStyle = '#3a2c1c'; ctx.fillRect(-11, -18, 22, 4);
    // head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -42 + breathe, 9, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(4, -43 + breathe, 1.6, 0, Math.PI * 2); ctx.fill();
    // class flair
    if (H.id === 'knight') {
      ctx.fillStyle = H.accent;
      ctx.beginPath(); ctx.arc(0, -44 + breathe, 9.5, Math.PI, 0); ctx.fill(); // helmet
      ctx.fillStyle = '#c33'; ctx.fillRect(-1.5, -56 + breathe, 3, 8); // plume
    } else if (H.id === 'mage') {
      ctx.fillStyle = H.body;
      ctx.beginPath(); ctx.moveTo(-11, -46 + breathe); ctx.lineTo(11, -46 + breathe); ctx.lineTo(2, -64 + breathe); ctx.closePath(); ctx.fill(); // hat
      ctx.fillStyle = H.accent; ctx.beginPath(); ctx.arc(2, -62 + breathe, 2.4, 0, Math.PI * 2); ctx.fill(); // star tip
    } else {
      ctx.fillStyle = H.body;
      ctx.beginPath(); ctx.ellipse(0, -47 + breathe, 10, 5, 0, Math.PI, 0); ctx.fill(); // hood brim
      ctx.fillStyle = '#e8b06a';
      ctx.beginPath(); ctx.arc(-6, -40 + breathe, 2.5, 0, Math.PI * 2); ctx.fill(); // braid
    }
    // arm + weapon
    ctx.save();
    ctx.translate(9, -28);
    ctx.rotate(-0.5 + armSwing + (state === 'attack' ? Math.sin(Math.min(1, t * 6)) * 1.6 : 0));
    ctx.fillStyle = '#f2c9a0'; ctx.fillRect(0, -2, 12, 5);
    if (H.weapon === 'sword') {
      ctx.fillStyle = '#dfe6f2'; ctx.fillRect(10, -10, 4, 18);
      ctx.fillStyle = '#b8862f'; ctx.fillRect(8, 6, 8, 3);
    } else if (H.weapon === 'staff') {
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(11, -14, 3, 24);
      ctx.fillStyle = H.accent; ctx.beginPath(); ctx.arc(12.5, -16, 4.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(12, 0, 9, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12 + 9 * Math.cos(-1.2), 9 * Math.sin(-1.2)); ctx.lineTo(12 + 9 * Math.cos(1.2), 9 * Math.sin(1.2)); ctx.stroke();
    }
    ctx.restore();
    if (state === 'hurt') { ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.fillRect(-14, -60, 28, 60); }
    ctx.restore();
  };

  // ---------- enemies ----------
  MD.drawEnemy = function (ctx, e, x, y, t, scale, hurtFlash) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const bounce = Math.abs(Math.sin(t * 3)) * -4;
    shadow(ctx, 0, 0, 18 * (e.shape.startsWith('boss') ? 1.6 : 1));
    ctx.translate(0, bounce);
    const c = hurtFlash ? '#ffffff' : e.color, d = hurtFlash ? '#ffdddd' : e.dark;
    ctx.fillStyle = c;
    switch (e.shape) {
      case 'slime': {
        const sq = 1 + Math.sin(t * 4) * 0.08;
        ctx.beginPath(); ctx.ellipse(0, -14, 18 * sq, 15 / sq, 0, Math.PI, 0); ctx.lineTo(18 * sq, 0); ctx.lineTo(-18 * sq, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = d; ctx.beginPath(); ctx.ellipse(-6, -8, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-5, -16, 2.4, 0, Math.PI * 2); ctx.arc(6, -16, 2.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bat': {
        const flap = Math.sin(t * 10) * 8;
        ctx.fillStyle = d;
        ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(-24, -26 - flap, -26, -10 - flap); ctx.quadraticCurveTo(-16, -14, -6, -12); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, -18); ctx.quadraticCurveTo(24, -26 - flap, 26, -10 - flap); ctx.quadraticCurveTo(16, -14, 6, -12); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -16, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(-3.5, -18, 1.8, 0, Math.PI * 2); ctx.arc(3.5, -18, 1.8, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'spider': {
        ctx.strokeStyle = d; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const a = 0.5 + i * 0.45, w = Math.sin(t * 6 + i) * 3;
          ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-16 - i * 3, -4 + i * 4 + w); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(16 + i * 3, -4 + i * 4 - w); ctx.stroke();
        }
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -14, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -16, 2, 0, Math.PI * 2); ctx.arc(4, -16, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-4, -16, 0.9, 0, Math.PI * 2); ctx.arc(4, -16, 0.9, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'goblin': case 'orc': {
        const big = e.shape === 'orc' ? 1.25 : 1;
        ctx.fillStyle = d; ctx.fillRect(-9 * big, -16, 7, 16); ctx.fillRect(3 * big, -16, 7, 16);
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-12 * big, -34, 24 * big, 20, 5); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -42 * big + 8, 10 * big, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; // ears
        ctx.beginPath(); ctx.moveTo(-10, -40); ctx.lineTo(-18, -46); ctx.lineTo(-9, -36); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -40); ctx.lineTo(18, -46); ctx.lineTo(9, -36); ctx.fill();
        ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(-4, -40, 2, 0, Math.PI * 2); ctx.arc(4, -40, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-4, -34, 3, 3); ctx.fillRect(2, -34, 3, 3); // teeth
        break;
      }
      case 'skeleton': {
        ctx.strokeStyle = c; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(-5, 0); ctx.moveTo(5, -14); ctx.lineTo(5, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(9, -24); ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -38, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-3.5, -39, 2.2, 0, Math.PI * 2); ctx.arc(3.5, -39, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(8, -30); ctx.stroke();
        break;
      }
      case 'ghost': {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, -18, 14, Math.PI, 0);
        const w = Math.sin(t * 5) * 3;
        ctx.lineTo(14, -4 + w); ctx.lineTo(8, -10); ctx.lineTo(2, -4 - w); ctx.lineTo(-4, -10); ctx.lineTo(-10, -4 + w); ctx.lineTo(-14, -18);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2a3550'; ctx.beginPath(); ctx.arc(-5, -20, 2.6, 0, Math.PI * 2); ctx.arc(5, -20, 2.6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'mage': {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-8, -34); ctx.lineTo(8, -34); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-10, -34); ctx.lineTo(10, -34); ctx.lineTo(0, -54); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -38, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(-2.5, -39, 1.5, 0, Math.PI * 2); ctx.arc(2.5, -39, 1.5, 0, Math.PI * 2); ctx.fill();
        const glow = 0.5 + Math.sin(t * 6) * 0.3;
        ctx.fillStyle = 'rgba(199,159,255,' + glow + ')'; ctx.beginPath(); ctx.arc(14, -26, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'boss_skull': {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -34, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-16, -34, 32, 20);
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -38, 6, 0, Math.PI * 2); ctx.arc(9, -38, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(-9, -38, 2.5 + Math.sin(t * 5) * 1, 0, Math.PI * 2); ctx.arc(9, -38, 2.5 + Math.sin(t * 5) * 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.crown || '#ffd35c';
        ctx.beginPath(); ctx.moveTo(-18, -52); ctx.lineTo(-12, -60); ctx.lineTo(-6, -52); ctx.lineTo(0, -62); ctx.lineTo(6, -52); ctx.lineTo(12, -60); ctx.lineTo(18, -52); ctx.closePath(); ctx.fill();
        break;
      }
      case 'boss_golem': {
        ctx.fillStyle = d; ctx.fillRect(-20, -26, 14, 26); ctx.fillRect(6, -26, 14, 26);
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-24, -58, 48, 34, 8); ctx.fill();
        ctx.beginPath(); ctx.roundRect(-16, -76, 32, 20, 6); ctx.fill();
        ctx.fillStyle = '#7ee2a0'; ctx.beginPath(); ctx.arc(-7, -66, 3.5, 0, Math.PI * 2); ctx.arc(7, -66, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d; ctx.fillRect(-24, -46, 48, 4);
        break;
      }
      case 'boss_wizard': {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-12, -46); ctx.lineTo(12, -46); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-14, -46); ctx.lineTo(14, -46); ctx.lineTo(0, -78); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a0a14'; ctx.beginPath(); ctx.arc(0, -52, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c79fff'; ctx.beginPath(); ctx.arc(-3, -53, 2, 0, Math.PI * 2); ctx.arc(3, -53, 2, 0, Math.PI * 2); ctx.fill();
        const g2 = 0.5 + Math.sin(t * 4) * 0.35;
        ctx.fillStyle = 'rgba(199,159,255,' + g2 + ')';
        ctx.beginPath(); ctx.arc(22, -40, 6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'boss_dragon': {
        ctx.fillStyle = d;
        const flap = Math.sin(t * 4) * 10;
        ctx.beginPath(); ctx.moveTo(-10, -40); ctx.quadraticCurveTo(-44, -56 - flap, -48, -24 - flap); ctx.quadraticCurveTo(-28, -30, -10, -26); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -40); ctx.quadraticCurveTo(44, -56 - flap, 48, -24 - flap); ctx.quadraticCurveTo(28, -30, 10, -26); ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(0, -26, 22, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -52, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-8, -62); ctx.lineTo(-14, -74); ctx.lineTo(-2, -64); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8, -62); ctx.lineTo(14, -74); ctx.lineTo(2, -64); ctx.fill();
        ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(-5, -54, 3, 0, Math.PI * 2); ctx.arc(5, -54, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-5, -54, 1.2, 0, Math.PI * 2); ctx.arc(5, -54, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb45c'; ctx.beginPath(); ctx.ellipse(0, -44, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default:
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -16, 16, 0, Math.PI * 2); ctx.fill();
    }
    if (e.elite) {
      ctx.fillStyle = '#ffd35c';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('\u2605', -5, -60);
    }
    ctx.restore();
  };

  // ---------- props ----------
  MD.drawChest = function (ctx, o, t) {
    const x = o.x, y = o.y;
    shadow(ctx, x, y, 18);
    const open = o.opened;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath(); ctx.roundRect(-18, -20, 36, 20, 3); ctx.fill();
    if (open) {
      ctx.save(); ctx.translate(-18, -20); ctx.rotate(-0.9);
      ctx.fillStyle = '#a06a34'; ctx.beginPath(); ctx.roundRect(0, -12, 36, 14, 3); ctx.fill();
      ctx.restore();
      const glow = 0.5 + Math.sin(t * 5) * 0.2;
      ctx.fillStyle = 'rgba(255,211,92,' + glow + ')';
      ctx.beginPath(); ctx.ellipse(0, -18, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#a06a34';
      ctx.beginPath(); ctx.moveTo(-18, -20); ctx.quadraticCurveTo(0, -36, 18, -20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = o.big ? '#ffd35c' : '#b8862f';
      ctx.fillRect(-3, -22, 6, 8);
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, -18, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  MD.drawFountain = function (ctx, o, t) {
    const x = o.x, y = o.y;
    shadow(ctx, x, y, 22);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#5a6a8a';
    ctx.beginPath(); ctx.ellipse(0, -6, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
    const g = 0.6 + Math.sin(t * 3) * 0.2;
    ctx.fillStyle = 'rgba(126,226,160,' + g + ')';
    ctx.beginPath(); ctx.ellipse(0, -8, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(126,226,160,.5)';
    for (let i = 0; i < 3; i++) {
      const yy = -14 - ((t * 30 + i * 12) % 26);
      ctx.beginPath(); ctx.arc(Math.sin(t * 2 + i * 2) * 8, yy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  MD.drawStone = function (ctx, o, t) {
    const x = o.x, y = o.y;
    shadow(ctx, x, y, 20);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = o.solved ? '#4a5a4a' : '#4a5068';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, -34); ctx.lineTo(12, -34); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    const g = 0.5 + Math.sin(t * 4) * 0.3;
    ctx.fillStyle = o.solved ? 'rgba(126,226,160,' + g + ')' : 'rgba(255,211,92,' + g + ')';
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(o.solved ? '\u2713' : '?', 0, -16);
    ctx.restore();
  };
  MD.drawCoins = function (ctx, o, t) {
    ctx.save(); ctx.translate(o.x, o.y);
    for (let i = 0; i < 3; i++) {
      const cx = (i - 1) * 10, spin = Math.abs(Math.sin(t * 3 + i));
      ctx.fillStyle = '#e8a92c';
      ctx.beginPath(); ctx.ellipse(cx, -6, 6 * spin + 1, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath(); ctx.ellipse(cx, -8, 3 * spin + 0.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- particles ----------
  MD.Particles = function (max) {
    const list = [];
    return {
      list,
      spawn(x, y, n, colors, opts) {
        opts = opts || {};
        for (let i = 0; i < n && list.length < max; i++) {
          const a = Math.random() * Math.PI * 2, sp = (opts.speed || 120) * (0.4 + Math.random() * 0.8);
          list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0), life: 1, decay: opts.decay || 1.6, r: (opts.r || 3) * (0.6 + Math.random() * 0.8), color: colors[Math.floor(Math.random() * colors.length)], grav: opts.grav === undefined ? 260 : opts.grav });
        }
      },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.life -= dt * p.decay;
          if (p.life <= 0) { list.splice(i, 1); continue; }
          p.vy += p.grav * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
      },
      draw(ctx) {
        for (const p of list) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
      clear() { list.length = 0; }
    };
  };

  // floating damage numbers
  MD.Floaters = function () {
    const list = [];
    return {
      list,
      spawn(x, y, text, color, size) { if (list.length < 24) list.push({ x, y, text, color: color || '#fff', size: size || 20, life: 1 }); },
      update(dt) { for (let i = list.length - 1; i >= 0; i--) { const f = list[i]; f.life -= dt * 0.9; f.y -= 40 * dt; if (f.life <= 0) list.splice(i, 1); } },
      draw(ctx) {
        for (const f of list) {
          ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
          ctx.font = 'bold ' + f.size + 'px "Chakra Petch", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 2, f.y + 2);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
      },
      clear() { list.length = 0; }
    };
  };

  // visual counting icons for math questions (battle panel canvas)
  MD.drawIcon = function (ctx, icon, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    if (icon === 'coin') {
      ctx.fillStyle = '#e8a92c'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a3'; ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.25, s * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (icon === 'gem') {
      ctx.fillStyle = '#5cd0ff';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, -s * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, -s * 0.2); ctx.lineTo(0, -s * 0.2); ctx.closePath(); ctx.fill();
    } else if (icon === 'potion') {
      ctx.fillStyle = '#7ee2a0'; ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cfe8ff'; ctx.fillRect(-s * 0.25, -s, s * 0.5, s * 0.8);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-s * 0.32, -s * 1.15, s * 0.64, s * 0.3);
    } else { // shield
      ctx.fillStyle = '#7d8aa8';
      ctx.beginPath(); ctx.moveTo(-s * 0.8, -s); ctx.lineTo(s * 0.8, -s); ctx.lineTo(s * 0.8, s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, s * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9d4ea'; ctx.fillRect(-s * 0.15, -s * 0.7, s * 0.3, s * 1.2);
    }
    ctx.restore();
  };
})(window);
