/* Math Dungeon — localStorage save/load + progress model. */
(function (root) {
  'use strict';
  const MD = (root.MD = root.MD || {});
  const KEY = 'math-dungeon-save-v1';

  const DEFAULT = {
    grade: null, age: null, hero: null,
    level: 1, xp: 0, gold: 0, hpBonus: 0, atkBonus: 0,
    potions: 1,
    upgrades: {},            // id -> true
    unlockedDungeon: 0,      // index of highest unlocked dungeon
    stars: {},               // dungeonIndex -> best stars
    stats: { total: 0, correct: 0, bestCombo: 0, cats: {} }, // cats: cat -> {a, c}
    recent: [],              // last 10 results 1/0 (adaptive difficulty)
    settings: { sound: true, music: true },
    tutorial: {},            // flag -> seen
    lastDungeon: 0
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT)), d, {
        stats: Object.assign(JSON.parse(JSON.stringify(DEFAULT.stats)), d.stats || {}),
        settings: Object.assign(JSON.parse(JSON.stringify(DEFAULT.settings)), d.settings || {}),
        upgrades: d.upgrades || {}, stars: d.stars || {}, tutorial: d.tutorial || {}, recent: d.recent || []
      });
    } catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }

  const XP_CURVE = lvl => 100 + (lvl - 1) * 90; // xp needed to reach lvl+1

  MD.Save = {
    KEY, DEFAULT, load, save, clear, hasSave, XP_CURVE,
    fresh() { return JSON.parse(JSON.stringify(DEFAULT)); }
  };
})(window);
