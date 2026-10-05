/* Math Survivor — localStorage persistence: per-grade high scores, settings, stats. */
export const Save = (function () {
  "use strict";
  const NS = "mathSurvivor.";
  function get(k, d) {
    try { const v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function set(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* quota/private mode */ }
  }
  return {
    best(grade) { return get("best.g" + grade, 0); },
    setBest(grade, score) {
      const cur = Save.best(grade);
      if (score > cur) { set("best.g" + grade, score); return true; }
      return false;
    },
    allBests() { const o = {}; for (let g = 1; g <= 6; g++) o[g] = Save.best(g); return o; },
    get grade() { return get("grade", 2); },
    set grade(g) { set("grade", g); },
    get sound() { return get("sound", true); },
    set sound(v) { set("sound", !!v); },
    get tutorialSeen() { return get("tut", false); },
    set tutorialSeen(v) { set("tut", !!v); },
    bumpPlayed() { set("played", get("played", 0) + 1); },
    get played() { return get("played", 0); }
  };
})();
