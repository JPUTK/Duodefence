// input.js
// Mouse, keyboard and button handling.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

// =====================================================================
// INPUT
// =====================================================================
function canvasPos(evt) {
  const r = cvs.getBoundingClientRect();
  return { x: (evt.clientX - r.left) * W / r.width, y: (evt.clientY - r.top) * H / r.height };
}

function panelHit(x, y) {
  for (let i = 0; i < 2; i++) {
    if (!inRect(x, y, PANELS[i])) continue;
    return { player: i, btn: panelButtons(i).find(b => inRect(x, y, b)) || null };
  }
  return null;
}

const inMenu = () => screen === "title" || state.over;

cvs.addEventListener("mousemove", evt => {
  mouse = canvasPos(evt);
  if (inMenu()) cvs.style.cursor = menuButtonAt(mouse.x, mouse.y) ? "pointer" : "default";
  else if (screen === "tutorial" && tutorialButtonAt(mouse.x, mouse.y)) cvs.style.cursor = "pointer";
  else cvs.style.cursor = "crosshair";
});
cvs.addEventListener("mouseleave", () => { mouse = { x: -100, y: -100 }; });

cvs.addEventListener("click", evt => {
  const { x, y } = canvasPos(evt);
  if (inMenu()) {
    const b = menuButtonAt(x, y);
    if (b) menuAction(b.id);
    return;
  }
  if (screen === "tutorial" && tutorialClick(x, y)) return;

  const ph = panelHit(x, y);
  if (ph) {
    if (ph.btn) {
      if (ph.btn.type === "give") give(ph.player);
      else { state.players[ph.player].sel = ph.btn.type; Sound.play("ui"); }
    }
    return;
  }
  if (y > FH) return;

  const owner = sideOf(x);
  if (owner < 0) return;
  const p = state.players[owner];
  const t = towerAt(x, y);

  // --- Merge selection in progress ---
  if (p.mergeSel) {
    const a = p.mergeSel;
    if (!t || t === a) { p.mergeSel = null; return; }
    if (canMerge(a, t)) { merge(a, t); return; }
    if (isElite(t)) { p.mergeSel = t; return; }
    p.mergeSel = null;
    floater(t.x, t.y - 22, "NEEDS ELITE OF ANOTHER TYPE", "#ff5a5a");
    return;
  }

  if (t) {
    if (isHybrid(t)) { floater(t.x, t.y - 26, TYPES[t.type].name, GOLD); return; }
    if (t.level < 3) { upgrade(t); return; }
    if (isElite(t)) {
      if (!state.towers.some(o => canMerge(t, o))) { floater(t.x, t.y - 22, "NO ELITE PARTNER IN RANGE", GOLD); return; }
      p.mergeSel = t;
      floater(t.x, t.y - 22, "PICK A PARTNER", GOLD);
      return;
    }
    floater(t.x, t.y - 22, "XP " + Math.floor(t.xp) + " / " + XP_ELITE, GOLD);
    return;
  }

  build(owner, p.sel, x, y);
});

cvs.addEventListener("contextmenu", evt => {
  evt.preventDefault();
  if (inMenu()) return;
  const { x, y } = canvasPos(evt);
  const t = towerAt(x, y);
  if (t) sell(t);
});

document.addEventListener("keydown", e => {
  const k = e.key;
  if (settingsOpen) {
    if (k === "Escape") closeSettings();
    return;
  }
  if (screen === "title") {
    if (k === "Enter") startGame();
    if (k === "ArrowLeft") { cycleDifficulty(-1); Sound.play("ui"); }
    if (k === "ArrowRight") { cycleDifficulty(1); Sound.play("ui"); }
    return;
  }
  if (state.over) {
    if (k === "Enter") startGame();
    if (k === "m" || k === "M") goToMenu();
    return;
  }
  KEYS.forEach((keys, pi) => {
    const idx = keys.indexOf(k);
    if (idx >= 0) { state.players[pi].sel = ORDER[idx]; Sound.play("ui"); }
  });
  if (k === " ") { e.preventDefault(); togglePause(); }
  if ((k === "n" || k === "N") && screen === "playing") startWave(true);
  if (k === "Escape") state.players.forEach(p => p.mergeSel = null);
});

function togglePause() {
  if (inMenu()) return;
  state.paused = !state.paused;
  document.getElementById("pause").textContent = state.paused ? "Resume" : "Pause";
}

document.getElementById("callWave").onclick = e => { if (screen === "playing" && !state.over) startWave(true); e.target.blur(); };
document.getElementById("pause").onclick = e => { togglePause(); e.target.blur(); };
document.getElementById("speed").onclick = e => {
  speedMul = speedMul === 1 ? 2 : 1;
  e.target.textContent = "Speed " + speedMul + "x";
  e.target.blur();
};
document.getElementById("restart").onclick = e => { startGame(); e.target.blur(); };
document.getElementById("menu").onclick = e => { closeSettings(); goToMenu(); e.target.blur(); };
document.getElementById("openSettings").onclick = e => { openSettings(); e.target.blur(); };
