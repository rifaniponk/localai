/* Math Dungeon — DOM screens, HUD, touch controls, shop, stats. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});
  const el = id => document.getElementById(id);
  const show = (id, on) => el(id).classList[on ? 'remove' : 'add']('hidden');

  const SCREENS = ['scrMenu', 'scrProfile', 'scrHero', 'scrHowto', 'scrPause', 'scrVictory', 'scrDefeat', 'scrUpgrade', 'scrStats'];

  MD.UI = {
    selectedGrade: null, selectedAge: null, selectedHero: null,
    screen(name) {
      SCREENS.forEach(s => show(s, s === name));
      const battleOn = name === null || name === 'battle';
      document.getElementById('battlePanel').classList[battleOn && MD.Battle.active ? 'remove' : 'add']('hidden');
    },
    hud(on) { show('hud', on); show('touchUI', on && MD.Game.isTouch); },

    // ---------- profile ----------
    buildProfile() {
      const grid = el('gradeGrid');
      grid.innerHTML = '';
      const ageSel = el('ageSel');
      ageSel.innerHTML = '<option value="">—</option>';
      for (let a = 5; a <= 13; a++) ageSel.innerHTML += '<option value="' + a + '">' + a + '</option>';
      const AGE2GRADE = { 5: 1, 6: 1, 7: 2, 8: 3, 9: 4, 10: 4, 11: 5, 12: 6, 13: 6 };
      for (let g = 1; g <= 6; g++) {
        const b = document.createElement('button');
        b.className = 'grade-btn';
        b.textContent = 'Grade ' + g;
        b.addEventListener('click', () => {
          MD.UI.selectedGrade = g;
          [...grid.children].forEach(c => c.classList.remove('sel'));
          b.classList.add('sel');
          el('gradeMsg').textContent = 'Grade ' + g + ' Adventure — perfect! Your dungeon will contain challenges made for your level.';
          el('btnGradeNext').disabled = false;
          MD.Audio.play('button');
        });
        grid.appendChild(b);
      }
      ageSel.addEventListener('change', () => {
        const a = parseInt(ageSel.value, 10);
        MD.UI.selectedAge = isNaN(a) ? null : a;
        if (!isNaN(a)) {
          const g = AGE2GRADE[a];
          const btn = grid.children[g - 1];
          if (btn && MD.UI.selectedGrade !== g) btn.click();
        }
      });
    },

    // ---------- hero select ----------
    buildHero() {
      const grid = el('heroGrid');
      grid.innerHTML = '';
      MD.HEROES.forEach(h => {
        const card = document.createElement('div');
        card.className = 'hero-card';
        const cv = document.createElement('canvas');
        cv.width = 96; cv.height = 96;
        const ctx = cv.getContext('2d');
        MD.drawHero(ctx, h.id, 48, 88, 'idle', 0.4, 1, 1.15);
        card.appendChild(cv);
        const n = document.createElement('div'); n.className = 'hname'; n.textContent = h.name; card.appendChild(n);
        const bl = document.createElement('div'); bl.className = 'hblurb'; bl.textContent = h.blurb; card.appendChild(bl);
        card.addEventListener('click', () => {
          MD.UI.selectedHero = h.id;
          [...grid.children].forEach(c => c.classList.remove('sel'));
          card.classList.add('sel');
          el('btnHeroNext').disabled = false;
          MD.Audio.play('button');
        });
        grid.appendChild(card);
      });
    },

    // ---------- HUD ----------
    updateHUD(p, save, roomIdx, totalRooms) {
      el('hpFill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
      el('hpText').textContent = Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp;
      const need = MD.Save.XP_CURVE(save.level);
      el('xpFill').style.width = Math.min(100, save.xp / need * 100) + '%';
      el('lvText').textContent = 'LV ' + save.level;
      el('goldText').textContent = save.gold;
      el('roomText').textContent = 'Room ' + (roomIdx + 1) + '/' + totalRooms;
      const chip = el('comboChip');
      if (MD.Battle.streak >= 2) { chip.classList.add('on'); chip.textContent = 'COMBO \u00d7' + MD.Battle.streak; }
      else chip.classList.remove('on');
      // portrait
      const pc = el('hudPortrait').getContext('2d');
      pc.clearRect(0, 0, 52, 52);
      MD.drawHero(pc, save.hero, 26, 48, 'idle', performance.now() / 1000, 1, 0.72);
      const pot = el('btnPotion');
      pot.classList[save.potions > 0 && MD.Game.state === 'battle' ? 'remove' : 'add']('hidden');
      el('potionCount').textContent = save.potions;
    },

    interactHint(x, y, label) {
      const h = el('interactHint');
      if (!label) { h.classList.add('hidden'); return; }
      h.classList.remove('hidden');
      el('interactLabel').textContent = label;
      const st = MD.Game.canvasToScreen(x, y);
      h.style.left = st.x + 'px';
      h.style.top = (st.y - 14) + 'px';
    },

    toast(msg, ms) {
      const t = el('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(MD.UI._toastT);
      MD.UI._toastT = setTimeout(() => t.classList.add('hidden'), ms || 2200);
    },

    // ---------- victory ----------
    showVictory(res) {
      el('vicStars').textContent = '\u2605'.repeat(res.stars) + '\u2606'.repeat(3 - res.stars);
      el('vicStats').innerHTML =
        '<div><b>' + res.acc + '%</b><span>Accuracy</span></div>' +
        '<div><b>' + res.correct + '/' + res.total + '</b><span>Correct</span></div>' +
        '<div><b>\u00d7' + res.bestCombo + '</b><span>Best Combo</span></div>' +
        '<div><b>+' + res.gold + '</b><span>Gold</span></div>' +
        '<div><b>+' + res.xp + '</b><span>XP</span></div>';
      const nextBtn = el('btnNextDun');
      nextBtn.textContent = res.nextUnlocked ? 'NEXT DUNGEON \u279c' : 'ALL DUNGEONS MASTERED \u2605';
      nextBtn.disabled = !res.nextUnlocked;
      MD.UI.screen('scrVictory');
    },

    // ---------- shop ----------
    SHOP: [
      { id: 'sword1', name: 'Iron Sword', desc: '+5 attack', cost: 40, atk: 5, req: null },
      { id: 'sword2', name: 'Steel Sword', desc: '+10 attack', cost: 90, atk: 10, req: 'sword1' },
      { id: 'sword3', name: 'Golden Sword', desc: '+15 attack', cost: 160, atk: 15, req: 'sword2' },
      { id: 'armor1', name: 'Leather Armor', desc: '+10 max HP', cost: 45, hp: 10, req: null },
      { id: 'armor2', name: 'Iron Armor', desc: '+20 max HP', cost: 100, hp: 20, req: 'armor1' },
      { id: 'boots1', name: 'Swift Boots', desc: 'Move faster', cost: 60, speed: 1.18, req: null },
      { id: 'potionpack', name: 'Potion Pack', desc: '+2 healing potions', cost: 30, potion: 2, req: null, repeat: true }
    ],
    renderShop() {
      const save = MD.Game.save;
      el('shopGold').textContent = save.gold;
      const list = el('shopList');
      list.innerHTML = '';
      MD.UI.SHOP.forEach(item => {
        const owned = save.upgrades[item.id] && !item.repeat;
        const locked = item.req && !save.upgrades[item.req];
        const row = document.createElement('div');
        row.className = 'shop-item' + (owned ? ' owned' : '');
        row.innerHTML = '<div><div class="si-name">' + item.name + '</div><div class="si-desc">' + item.desc + '</div></div>';
        const b = document.createElement('button');
        if (owned) b.textContent = 'OWNED';
        else if (locked) b.textContent = 'LOCKED';
        else b.textContent = item.cost + ' \ud83e\ude99';
        b.disabled = owned || locked || save.gold < item.cost;
        b.addEventListener('click', () => {
          if (save.gold < item.cost) return;
          save.gold -= item.cost;
          if (item.potion) save.potions += item.potion;
          else save.upgrades[item.id] = true;
          MD.Game.recalcStats();
          MD.Save.save(save);
          MD.Audio.play('coin');
          MD.UI.renderShop();
          MD.UI.toast(item.name + ' acquired!');
        });
        row.appendChild(b);
        list.appendChild(row);
      });
    },

    // ---------- stats ----------
    renderStats() {
      const s = MD.Game.save.stats;
      const acc = s.total ? Math.round(s.correct / s.total * 100) : 0;
      el('statsSummary').innerHTML =
        '<div><b>' + s.total + '</b><span>Answered</span></div>' +
        '<div><b>' + s.correct + '</b><span>Correct</span></div>' +
        '<div><b>' + acc + '%</b><span>Accuracy</span></div>' +
        '<div><b>\u00d7' + s.bestCombo + '</b><span>Best Combo</span></div>';
      const cats = el('statsCats');
      cats.innerHTML = '';
      const entries = Object.entries(s.cats).sort((a, b) => b[1].a - a[1].a);
      if (!entries.length) cats.innerHTML = '<p style="color:var(--dim)">Answer some questions to see your progress here!</p>';
      entries.forEach(([cat, st]) => {
        const pct = Math.round(st.c / st.a * 100);
        const row = document.createElement('div');
        row.className = 'cat-row';
        const label = MD.MathGen.CATEGORY_LABELS[cat] || cat;
        row.innerHTML = '<span>' + label + '</span><div class="cat-bar"><i style="width:' + pct + '%"></i></div><span>' + pct + '%' + (st.a >= 4 && pct < 70 ? ' <span class="cat-tag">Needs Practice</span>' : '') + '</span>';
        cats.appendChild(row);
      });
    },

    // ---------- toggles ----------
    syncToggles() {
      const s = MD.Game.save.settings;
      const ts = el('tglSound'), tm = el('tglMusic');
      ts.textContent = s.sound ? 'ON' : 'OFF'; ts.classList[!s.sound ? 'add' : 'remove']('off');
      tm.textContent = s.music ? 'ON' : 'OFF'; tm.classList[!s.music ? 'add' : 'remove']('off');
    }
  };
})(window);
