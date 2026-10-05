/* Math Survivor — UI shell: screens, calculator keypad, HUD, game over, debug. */
import { Engine } from "./engine.js";
import { Save } from "./save.js";
import { Audio } from "./audio.js";

const $ = s => document.querySelector(s);
const body = document.body;

const screens = { intro: $("#intro"), over: $("#over") };
function show(name) {
  body.dataset.screen = name;
  for (const k in screens) screens[k].classList.toggle("on", k === name);
}

// ---------------- intro / grade select ----------------
function renderGrades() {
  const wrap = $("#gradeGrid");
  wrap.innerHTML = "";
  for (let g = 1; g <= 6; g++) {
    const b = document.createElement("button");
    b.className = "gradeCard" + (g === Save.grade ? " sel" : "");
    b.innerHTML = "<span class='gc-num'>" + g + "</span><span class='gc-best'>BEST " + Save.best(g).toLocaleString("en-US") + "</span>";
    b.addEventListener("click", () => {
      Save.grade = g;
      Audio.unlock(); Audio.cues.tap(g);
      renderGrades();
    });
    wrap.appendChild(b);
  }
  $("#playedLine").textContent = Save.played > 0 ? "Games played: " + Save.played : "First run? Pick a grade and go!";
}

// ---------------- HUD ----------------
const hud = { score: $("#hudScore"), hearts: $("#hudHearts"), combo: $("#hudCombo"), best: $("#hudBest"), stage: $("#hudStage"), boss: $("#hudBoss") };
function onHud(h) {
  hud.score.textContent = h.score.toLocaleString("en-US");
  hud.best.textContent = "BEST " + Save.best(h.grade).toLocaleString("en-US");
  let hearts = "";
  for (let i = 0; i < h.maxHp; i++) hearts += "<span class='heart" + (i < h.hp ? "" : " lost") + "'>\u2764</span>";
  hud.hearts.innerHTML = hearts;
  if (h.combo >= 2) {
    hud.combo.textContent = "COMBO \u00D7" + h.combo + (h.mult > 1 ? " (\u00D7" + h.mult + ")" : "");
    hud.combo.classList.add("on");
    hud.combo.classList.toggle("hot", h.combo >= 10);
  } else hud.combo.classList.remove("on");
  hud.stage.textContent = h.stage;
  if (h.bossHp > 0) {
    hud.boss.classList.add("on");
    hud.boss.innerHTML = "BOSS " + "\u2764".repeat(h.bossHp) + "<span class='lost'>" + "\u2764".repeat(h.bossMax - h.bossHp) + "</span>";
  } else hud.boss.classList.remove("on");
}

// ---------------- calculator input ----------------
let input = "";
const inputEl = $("#inputDisplay");
function renderInput() {
  inputEl.textContent = input || "\u00A0";
  inputEl.classList.toggle("neg", input.startsWith("-"));
}
function pressKey(k) {
  if (!engine.running) return;
  if (k === "back") { input = input.slice(0, -1); Audio.cues.tap(1); }
  else if (k === "neg") { input = input.startsWith("-") ? input.slice(1) : "-" + input; Audio.cues.tap(3); }
  else if (k === "enter") {
    if (!input || input === "-") return;
    Audio.cues.enter();
    const n = parseInt(input, 10);
    input = "";
    renderInput();
    engine.submit(n);
    return;
  } else {
    if (input.replace("-", "").length >= 4) return; // cap at 4 chars (max answer 999 + sign)
    input += k;
    Audio.cues.tap(parseInt(k, 10) || 0);
  }
  renderInput();
}
function buildKeypad() {
  const kp = $("#keypad");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "neg", "0", "enter"];
  for (const k of keys) {
    const b = document.createElement("button");
    b.className = "key" + (k === "enter" ? " kenter" : k === "neg" ? " kneg" : "");
    b.textContent = k === "enter" ? "ENTER" : k === "neg" ? "\u2212" : k;
    b.dataset.key = k;
    b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("down"); pressKey(k); });
    b.addEventListener("pointerup", () => b.classList.remove("down"));
    b.addEventListener("pointerleave", () => b.classList.remove("down"));
    kp.appendChild(b);
  }
  const del = document.createElement("button");
  del.className = "key kdel"; del.textContent = "\u232B"; del.dataset.key = "back";
  del.addEventListener("pointerdown", e => { e.preventDefault(); del.classList.add("down"); pressKey("back"); });
  del.addEventListener("pointerup", () => del.classList.remove("down"));
  del.addEventListener("pointerleave", () => del.classList.remove("down"));
  $("#keyRow0").appendChild(del);
}
window.addEventListener("keydown", e => {
  if (body.dataset.screen !== "game") return;
  if (e.key >= "0" && e.key <= "9") pressKey(e.key);
  else if (e.key === "Enter") pressKey("enter");
  else if (e.key === "Backspace") pressKey("back");
  else if (e.key === "-") pressKey("neg");
  else return;
  e.preventDefault();
});

// feedback flashes
function onFeedback(kind) {
  const el = $("#inputWrap");
  el.classList.remove("fb-correct", "fb-wrong");
  void el.offsetWidth; // restart animation
  el.classList.add(kind === "correct" ? "fb-correct" : "fb-wrong");
}

// ---------------- engine ----------------
const engine = new Engine({
  canvas: $("#gl"),
  labels: $("#labels"),
  onHud,
  onFeedback,
  onStage(name) {
    const t = $("#stageToast");
    t.textContent = name;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
  },
  onGameOver(stats) {
    const isBest = Save.setBest(stats.grade, stats.score);
    if (isBest) setTimeout(() => Audio.cues.highScore(), 300);
    $("#overNew").classList.toggle("on", isBest);
    $("#ovScore").textContent = stats.score.toLocaleString("en-US");
    $("#ovBest").textContent = Save.best(stats.grade).toLocaleString("en-US");
    $("#ovGrade").textContent = "GRADE " + stats.grade;
    $("#ovKills").textContent = stats.kills;
    const acc = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
    $("#ovAcc").textContent = acc + "%";
    $("#ovCombo").textContent = "\u00D7" + stats.bestCombo;
    $("#ovTime").textContent = Math.floor(stats.time / 60) + ":" + String(Math.floor(stats.time % 60)).padStart(2, "0");
    show("over");
  }
});
window.__GAME = {
  get state() { return { running: engine.running, gameOver: !!engine.gameOver, hp: engine.hp, score: engine.score, combo: engine.combo, time: engine.time, targets: engine.targets.map(t => ({ kind: t.kind, answer: t.answer, targeted: t.targeted })), answers: [...engine.answerMap.keys()], projs: engine.projs.length, boss: !!engine.boss }; },
  start(g) { startRun(g); },
  submit(n) { return engine.submit(n); },
  type(n) { input = String(n); renderInput(); pressKey("enter"); },
  spawnEnemy(t) { engine._spawnEnemy(t); },
  spawnPowerup(t) { engine._spawnPowerup(t); },
  spawnBoss() { engine._spawnBoss(); },
  clearEnemies() { for (const e of [...engine.targets]) if (e.kind === "enemy") engine._removeTarget(e); },
  addHp() { engine.hp = Math.min(engine.maxHp, engine.hp + 1); engine._pushHud(); },
  fastForward(s) { engine.time += s; }
};

// ---------------- flow ----------------
function startRun(grade) {
  Audio.unlock();
  Save.grade = grade;
  Save.bumpPlayed();
  input = ""; renderInput();
  if (!Save.tutorialSeen && !/[?&]debug=true/.test(location.search)) {
    Save.tutorialSeen = true;
    $("#tut").classList.add("on");
    setTimeout(() => $("#tut").classList.remove("on"), 4200);
  }
  show("game");
  engine.start(grade);
}

$("#playBtn").addEventListener("click", () => { Audio.unlock(); startRun(Save.grade); });
$("#againBtn").addEventListener("click", () => startRun(Save.grade));
$("#menuBtn").addEventListener("click", () => { renderGrades(); show("intro"); });
$("#pauseBtn").addEventListener("click", () => {
  engine.paused = !engine.paused;
  $("#pauseBtn").textContent = engine.paused ? "\u25B6" : "\u275A\u275A";
  $("#pauseVeil").classList.toggle("on", engine.paused);
});
$("#soundBtn").addEventListener("click", () => {
  const v = !Save.sound;
  Save.sound = v; Audio.setEnabled(v);
  $("#soundBtn").textContent = v ? "\uD83D\uDD0A" : "\uD83D\uDD07";
});

// debug panel
if (/[?&]debug=true/.test(location.search)) {
  const d = $("#debug");
  d.classList.add("on");
  const rows = {};
  const mk = (label, fn) => { const b = document.createElement("button"); b.textContent = label; b.addEventListener("click", fn); d.appendChild(b); };
  mk("spawn enemy", () => engine._spawnEnemy());
  mk("spawn powerup", () => engine._spawnPowerup());
  mk("spawn boss", () => engine._spawnBoss());
  mk("clear enemies", () => { for (const e of [...engine.targets]) if (e.kind === "enemy") engine._removeTarget(e); });
  mk("+1 HP", () => engine.addHp && engine.hp < engine.maxHp && (engine.hp++, engine._pushHud()));
  mk("+60s", () => { engine.time += 60; });
  const info = document.createElement("pre");
  d.prepend(info);
  setInterval(() => {
    const s = window.__GAME.state;
    info.textContent = "fps~" + Math.round(engine._fps || 0) + " | t=" + s.time.toFixed(0) + "s | enemies=" + s.targets.length +
      " | projs=" + s.projs + " | boss=" + s.boss + " | answers=[" + s.answers.join(",") + "]";
  }, 400);
}

// boot
Save.sound ? Audio.setEnabled(true) : Audio.setEnabled(false);
$("#soundBtn").textContent = Save.sound ? "\uD83D\uDD0A" : "\uD83D\uDD07";
buildKeypad();
renderGrades();
renderInput();
if (/[?&]autostart=1/.test(location.search)) {
  const g = parseInt((location.search.match(/[?&]grade=(\d)/) || [])[1] || "2", 10);
  startRun(g);
} else {
  show("intro");
}
