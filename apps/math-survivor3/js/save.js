/* localStorage persistence: best run, volume, tutorial seen */

const KEY = 'math-survivor3';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch (e) { return {}; }
}
function save(obj) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...obj })); }
  catch (e) { /* private mode */ }
}

const Save = {
  best() { return load().best || 0; },
  setBest(score) { if (score > Save.best()) { save({ best: score }); return true; } return false; },
  volume() { const v = load().volume; return typeof v === 'number' ? v : 0.8; },
  setVolume(v) { save({ volume: v }); },
  tutorialSeen() { return !!load().tut; },
  markTutorial() { save({ tut: true }); },
};

export default Save;
