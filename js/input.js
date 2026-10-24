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

cvs.addEventListener("mousemove", evt => { mouse = canvasPos(evt); });
cvs.addEventListener("mouseleave", () => { mouse = { x: -100, y: -100 }; });

cvs.addEventListener("click", evt => {
  if (state.over) { reset(); return; }
  const { x, y } = canvasPos(evt);

  const ph = panelHit(x, y);
  if (ph) {
    if (ph.btn) ph.btn.type === "give" ? give(ph.player) : (state.players[ph.player].sel = ph.btn.type);
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
  if (state.over) return;
  const { x, y } = canvasPos(evt);
  const t = towerAt(x, y);
  if (t) sell(t);
});

document.addEventListener("keydown", e => {
  const k = e.key;
  KEYS.forEach((keys, pi) => {
    const idx = keys.indexOf(k);
    if (idx >= 0) state.players[pi].sel = ORDER[idx];
  });
  if (k === " ") { e.preventDefault(); togglePause(); }
  if (k === "n" || k === "N") startWave(true);
  if (k === "Escape") state.players.forEach(p => p.mergeSel = null);
});

function togglePause() {
  if (state.over) return;
  state.paused = !state.paused;
  document.getElementById("pause").textContent = state.paused ? "Resume" : "Pause";
}

document.getElementById("callWave").onclick = e => { startWave(true); e.target.blur(); };
document.getElementById("pause").onclick = e => { togglePause(); e.target.blur(); };
document.getElementById("speed").onclick = e => {
  speedMul = speedMul === 1 ? 2 : 1;
  e.target.textContent = "Speed " + speedMul + "x";
  e.target.blur();
};
document.getElementById("restart").onclick = e => {
  reset();
  document.getElementById("pause").textContent = "Pause";
  e.target.blur();
};
