/* Math Dungeon — battle system: question panel, combo, adaptive difficulty.
   Owns the DOM answer panel; game.js owns HP/damage/feedback via callbacks. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});
  const G = () => MD.MathGen;

  const el = id => document.getElementById(id);
  let panel, promptEl, answersEl, fbEl, fbTitle, fbText, visCanvas;
  let active = null; // {enemy, kind, question, streak, locked}
  let cb = null;     // callbacks from game: {onCorrect(dmg,power), onWrong(), onEnemyDefeated(), onPuzzleSolved(), onPuzzleFailed(), onChestOpened(), onChestFailed()}
  let inputVal = '';

  // adaptive tier from recent results + dungeon depth (never changes grade)
  function currentTier(save, dungeonIdx) {
    const base = 1 + Math.min(2, Math.floor(dungeonIdx / 2));
    const rec = save.recent.slice(-10);
    if (rec.length >= 5) {
      const acc = rec.reduce((s, v) => s + v, 0) / rec.length;
      if (acc >= 0.85) return Math.min(3, base + 1);
      if (acc < 0.6) return Math.max(1, base - 1);
    }
    return base;
  }

  function nextQuestion(hard) {
    const save = MD.Game.save;
    let tier = currentTier(save, MD.Game.dungeonIdx);
    if (hard) tier = Math.min(3, tier + 1);
    const recentCats = (active && active.recentCats) || [];
    const q = G().makeQuestion(save.grade, tier, save.stats.cats, recentCats);
    if (active) {
      active.recentCats = (active.recentCats.concat([q.category])).slice(-3);
      active.question = q;
    }
    return q;
  }

  function renderQuestion(q) {
    promptEl.innerHTML = q.prompt;
    fbEl.classList.add('hidden');
    answersEl.innerHTML = '';
    answersEl.className = '';
    visCanvas.classList.add('hidden');
    inputVal = '';

    if (q.visual) { // counting question: draw icons on canvas
      visCanvas.classList.remove('hidden');
      const vc = visCanvas.getContext('2d');
      visCanvas.width = 360; visCanvas.height = 90;
      vc.clearRect(0, 0, 360, 90);
      const n = q.answer;
      const perRow = Math.min(n, 8);
      const rows = Math.ceil(n / perRow);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / perRow), c = i % perRow;
        const inRow = Math.min(perRow, n - r * perRow);
        const x = 180 + (c - (inRow - 1) / 2) * 38;
        const y = 45 + (r - (rows - 1) / 2) * 40;
        MD.drawIcon(vc, q.visual.icon, x, y, 14);
      }
    }

    if (q.mode === 'input') {
      renderKeypad(q);
    } else {
      answersEl.className = q.choices.length === 2 ? 'two' : '';
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'ans-btn';
        b.textContent = c;
        b.dataset.idx = i;
        b.addEventListener('click', () => answer(c, b));
        answersEl.appendChild(b);
      });
    }
  }

  function renderKeypad(q) {
    const wrap = document.createElement('div');
    wrap.className = 'ni-wrap';
    const disp = document.createElement('div');
    disp.className = 'ni-display'; disp.textContent = '_';
    const kp = document.createElement('div');
    kp.className = 'keypad';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '\u00b1', '0', '\u232b'];
    keys.forEach(k => {
      const b = document.createElement('button');
      b.textContent = k;
      b.addEventListener('click', () => {
        if (k === '\u232b') inputVal = inputVal.slice(0, -1);
        else if (k === '\u00b1') inputVal = inputVal.startsWith('-') ? inputVal.slice(1) : '-' + inputVal;
        else if (inputVal.length < 6) inputVal += k;
        disp.textContent = inputVal || '_';
      });
      kp.appendChild(b);
    });
    const go = document.createElement('button');
    go.className = 'ans-btn'; go.style.gridColumn = 'span 3'; go.style.minHeight = '52px';
    go.textContent = 'ATTACK!';
    go.addEventListener('click', () => { if (inputVal !== '' && inputVal !== '-') answer(parseFloat(inputVal), go); });
    answersEl.appendChild(wrap);
    wrap.appendChild(disp); wrap.appendChild(kp);
    answersEl.appendChild(go);
  }

  function answer(val, btn) {
    if (!active || active.locked) return;
    const q = active.question;
    const numOk = typeof q.answer === 'number' && typeof val === 'number' && Math.abs(val - q.answer) < 1e-9;
    const strOk = String(val) === String(q.answer);
    const correct = numOk || strOk;
    const save = MD.Game.save;

    // record stats
    save.stats.total++;
    if (correct) save.stats.correct++;
    const cat = save.stats.cats[q.category] || (save.stats.cats[q.category] = { a: 0, c: 0 });
    cat.a++; if (correct) cat.c++;
    save.recent = (save.recent.concat(correct ? 1 : 0)).slice(-10);

    if (correct) {
      MD.Audio.play('correct');
      if (btn) btn.classList.add('right');
      active.streak++;
      if (active.streak > save.stats.bestCombo) save.stats.bestCombo = active.streak;
      MD.Save.save(save);
      active.locked = true;
      setTimeout(() => {
        active.locked = false;
        cb.onCorrect(active.streak, q);
        if (active.done) return;
        nextAndRender(false);
      }, 420);
    } else {
      MD.Audio.play('wrong');
      if (btn) btn.classList.add('wrong');
      active.streak = 0;
      MD.Save.save(save);
      // gentle learning feedback, then continue
      active.locked = true;
      fbEl.classList.remove('hidden');
      fbEl.classList.remove('good');
      fbTitle.textContent = 'Almost!';
      fbText.textContent = q.explain || (q.prompt + ' = ' + q.answer);
      setTimeout(() => {
        active.locked = false;
        cb.onWrong(q);
        if (active.done) return;
        nextAndRender(false);
      }, 1500);
    }
  }

  function nextAndRender(hard) { renderQuestion(nextQuestion(hard)); }

  MD.Battle = {
    init() {
      panel = el('battlePanel'); promptEl = el('bpPrompt'); answersEl = el('bpAnswers');
      fbEl = el('bpFeedback'); fbTitle = el('bpFbTitle'); fbText = el('bpFbText');
      visCanvas = el('bpVis');
    },
    // kind: 'monster' | 'elite' | 'boss' | 'puzzle' | 'chest'
    start(enemy, kind, callbacks) {
      cb = callbacks;
      active = { enemy, kind, streak: 0, locked: false, done: false, recentCats: [] };
      panel.classList.remove('hidden');
      nextAndRender(kind === 'boss' || kind === 'elite');
    },
    end() {
      active = null;
      panel.classList.add('hidden');
    },
    // E2E/test hook: answer programmatically (number or string)
    _testAnswer(v) { if (active && !active.locked) answer(v, null); },
    get active() { return active; },
    get streak() { return active ? active.streak : 0; },
    // keyboard 1-4 / digits during battle
    key(k) {
      if (!active || active.locked) return false;
      const q = active.question;
      if (q.mode === 'input') {
        if (/^[0-9]$/.test(k)) { if (inputVal.length < 6) inputVal += k; const d = answersEl.querySelector('.ni-display'); if (d) d.textContent = inputVal || '_'; return true; }
        if (k === 'Backspace') { inputVal = inputVal.slice(0, -1); const d = answersEl.querySelector('.ni-display'); if (d) d.textContent = inputVal || '_'; return true; }
        if (k === 'Enter' && inputVal !== '' && inputVal !== '-') { answer(parseFloat(inputVal), null); return true; }
        return false;
      }
      const n = parseInt(k, 10);
      if (n >= 1 && n <= q.choices.length) {
        const btn = answersEl.querySelector('[data-idx="' + (n - 1) + '"]');
        answer(q.choices[n - 1], btn);
        return true;
      }
      return false;
    },
    currentTier
  };
})(window);
