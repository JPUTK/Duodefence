// screens.js
// Title screen (with a live demo battle behind it) and the game-over menu.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

let screen = "title"; // "title", "tutorial" or "playing"
let demoLayout = null; // turret positions for the demo, worked out once

function setScreen(s) {
  screen = s;
  const controls = document.querySelector(".controls");
  if (controls) controls.style.visibility = s === "title" ? "hidden" : "visible";
}

// =====================================================================
// SWITCHING SCREENS
// =====================================================================
function startGame() {
  reset();
  setScreen("playing");
  document.getElementById("pause").textContent = "Pause";
  cvs.style.cursor = "crosshair";
  Sound.setMode("game");
}

function goToMenu() {
  startDemo();
  setScreen("title");
  Sound.setMode("menu");
}

// Builds a strong pre-made defense on both sides and lets the waves roll,
// so the title screen shows the game being played.
function startDemo() {
  reset();
  state.players.forEach(p => { p.core = 9999; p.credits = 0; });
  state.nextWaveIn = 2;
  if (!demoLayout) demoLayout = planDemoLayout();
  for (const d of demoLayout) {
    const hybrid = !!TYPES[d.type].parts;
    state.towers.push({
      type: d.type, owner: d.owner, level: hybrid ? 1 : 3, x: d.x, y: d.y,
      cool: Math.random(), flash: 0, angle: d.owner ? Math.PI : 0, spent: 0, xp: hybrid ? 0 : XP_ELITE
    });
  }
}

function planDemoLayout() {
  const plans = [
    ["laser", "plasma", "frost", "laser", "cryo", "ion", "plasma"],
    ["plasma", "laser", "nova", "plasma", "cryo", "ion", "laser"]
  ];
  const samples = LANES.map(l => {
    const pts = [];
    for (let s = 0; s < l.len; s += 10) {
      const p = pointAt(l, s);
      if (p.y >= 0 && p.y <= FH) pts.push(p);
    }
    return pts;
  });
  const layout = [];
  plans.forEach((types, owner) => {
    for (const type of types) {
      const range = TYPES[type].lv[TYPES[type].parts ? 0 : 2].range;
      let bestSpot = null, bestScore = -1;
      for (let x = 20; x < W; x += 12) {
        for (let y = 20; y < FH; y += 12) {
          if (!canBuild(x, y, owner)) continue;
          let score = 0;
          for (const p of samples[owner]) if (Math.hypot(p.x - x, p.y - y) <= range) score++;
          if (score > bestScore) { bestScore = score; bestSpot = { x, y }; }
        }
      }
      if (!bestSpot) continue;
      layout.push({ owner, type, ...bestSpot });
      // reserve the spot so the next turret goes somewhere else
      state.towers.push({ type, owner, level: 1, x: bestSpot.x, y: bestSpot.y, xp: 0 });
    }
  });
  state.towers = [];
  return layout;
}

// Keeps the demo fresh: after wave 10, hold off the next wave and
// restart the demo once the field is clear.
function updateDemo(dt) {
  if (state.wave >= 10) state.nextWaveIn = Math.max(state.nextWaveIn, 1);
  update(dt);
  state.banner = null;
  const pending = state.queues[0].length + state.queues[1].length;
  if (state.wave >= 10 && !pending && !state.enemies.length) startDemo();
}

// =====================================================================
// MENU BUTTONS
// =====================================================================
function menuButtons() {
  if (screen === "title") {
    return [
      { id: "diff-prev", label: "◀", x: MID - 130, y: 356, w: 36, h: 34, arrow: true },
      { id: "diff-next", label: "", x: MID - 90, y: 356, w: 180, h: 34, hidden: true },
      { id: "diff-next", label: "▶", x: MID + 94, y: 356, w: 36, h: 34, arrow: true },
      { id: "start", label: "START GAME", x: MID - 130, y: 420, w: 260, h: 50, primary: true },
      { id: "howto", label: "HOW TO PLAY", x: MID - 130, y: 480, w: 260, h: 40 },
      { id: "settings", label: "SETTINGS", x: MID - 130, y: 528, w: 260, h: 40 }
    ];
  }
  if (state.over) {
    const y = FH / 2 + 60;
    return [
      { id: "redeploy", label: "REDEPLOY", x: MID - 210, y, w: 200, h: 46, primary: true },
      { id: "menu", label: "MAIN MENU", x: MID + 10, y, w: 200, h: 46 }
    ];
  }
  return [];
}

function menuButtonAt(x, y) {
  return menuButtons().find(b => inRect(x, y, b)) || null;
}

function menuAction(id) {
  Sound.play("ui");
  if (id === "start" || id === "redeploy") startGame();
  else if (id === "menu") goToMenu();
  else if (id === "howto") startTutorial();
  else if (id === "settings") openSettings();
  else if (id === "diff-prev") cycleDifficulty(-1);
  else if (id === "diff-next") cycleDifficulty(1);
}

function drawMenuButton(b) {
  if (b.hidden) return;
  const hover = inRect(mouse.x, mouse.y, b);
  if (b.arrow) {
    const c = DIFFICULTIES[difficulty].color;
    ctx.save();
    ctx.fillStyle = hover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)";
    ctx.strokeStyle = hover ? c : "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hover ? c : "#c6cdea"; ctx.font = "900 13px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.restore();
    return;
  }
  const pulse = 0.5 + 0.5 * Math.sin(animT * 3);
  ctx.save();
  ctx.fillStyle = b.primary
    ? "rgba(56,225,255," + (hover ? 0.32 : 0.14 + pulse * 0.06) + ")"
    : "rgba(255,255,255," + (hover ? 0.12 : 0.04) + ")";
  ctx.strokeStyle = b.primary ? PCOL[0] : (hover ? "#dfe6ff" : "rgba(255,255,255,0.35)");
  ctx.lineWidth = b.primary ? 2 : 1.5;
  ctx.shadowColor = PCOL[0];
  ctx.shadowBlur = b.primary ? (hover ? 26 : 10 + pulse * 10) : (hover ? 12 : 0);
  roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = hover || b.primary ? "#ffffff" : "#c6cdea";
  ctx.font = "900 " + (b.primary ? 18 : 14) + "px " + FONT;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

// =====================================================================
// TITLE SCREEN
// =====================================================================
function drawTitle() {
  // Dim the demo battle behind the menu
  ctx.fillStyle = "#05070f"; ctx.fillRect(0, FH, W, H - FH);
  const veil = ctx.createRadialGradient(MID, 300, 60, MID, 300, 620);
  veil.addColorStop(0, "rgba(3,5,12,0.9)");
  veil.addColorStop(1, "rgba(3,5,12,0.55)");
  ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);

  drawCenteredText("A  CO-OP  TOWER  DEFENSE", 150, 12, "#9aa5c9", 700);

  // Logo
  ctx.save();
  ctx.font = "900 72px " + FONT;
  ctx.textAlign = "center";
  const grad = ctx.createLinearGradient(MID - 300, 0, MID + 300, 0);
  grad.addColorStop(0, PCOL[0]); grad.addColorStop(0.5, "#b77bff"); grad.addColorStop(1, PCOL[1]);
  ctx.fillStyle = grad;
  ctx.shadowColor = "#9a5cff"; ctx.shadowBlur = 24 + 10 * Math.sin(animT * 2);
  ctx.fillText("RIFT DEFENSE", MID, 232);
  ctx.restore();

  // Glowing rule under the logo
  const rule = ctx.createLinearGradient(MID - 220, 0, MID + 220, 0);
  rule.addColorStop(0, "rgba(56,225,255,0)"); rule.addColorStop(0.5, "rgba(183,123,255,0.9)"); rule.addColorStop(1, "rgba(255,79,216,0)");
  ctx.fillStyle = rule; ctx.fillRect(MID - 220, 256, 440, 2);

  drawCenteredText("Guard your ally's core. Trust them to guard yours.", 292, 15, "#dfe6ff", 500);

  // Player legend
  ctx.font = "700 11px " + FONT;
  ctx.textAlign = "right"; ctx.fillStyle = PCOL[0];
  ctx.fillText("◀ PLAYER 1 · SWARM LANE", MID - 18, 330);
  ctx.textAlign = "left"; ctx.fillStyle = PCOL[1];
  ctx.fillText("HEAVY LANE · PLAYER 2 ▶", MID + 18, 330);
  ctx.fillStyle = "#b77bff";
  ctx.beginPath(); ctx.arc(MID, 326, 3, 0, Math.PI * 2); ctx.fill();

  // Difficulty picker
  const D = DIFFICULTIES[difficulty];
  ctx.save();
  ctx.shadowColor = D.color; ctx.shadowBlur = 12;
  drawCenteredText(D.label, 379, 17, D.color, 900);
  ctx.restore();
  drawCenteredText(D.desc, 406, 10, "#9aa5c9", 500);

  menuButtons().forEach(drawMenuButton);

  if (best > 0) drawCenteredText("BEST ON " + D.label + ": WAVE " + best, 596, 12, "#b77bff", 700);
  drawCenteredText("2 PLAYERS  ·  SHARED SCREEN  ·  ◀ ▶ DIFFICULTY  ·  ENTER TO START", 652, 10, "#7f8bb3", 500);
  if (Sound.supported && !Sound.unlocked) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(animT * 3);
    drawCenteredText("♪  CLICK ANYWHERE TO ENABLE SOUND", 628, 10, GOLD, 700);
    ctx.globalAlpha = 1;
  }
}

// =====================================================================
// GAME OVER
// =====================================================================
function drawGameOver() {
  ctx.fillStyle = "rgba(3,5,12,0.82)"; ctx.fillRect(0, 0, W, H);
  drawCenteredText("CORE BREACHED", FH / 2 - 40, 40, "#ff5a5a", 900);
  drawCenteredText("You held the line together for " + state.wave + " waves", FH / 2 - 2, 16, "#e8ecff", 500);
  const D = DIFFICULTIES[state.diff];
  const record = !!state.newBest;
  drawCenteredText((record ? "★ NEW BEST ON " : "BEST ON ") + D.label + ": WAVE " + bests[state.diff], FH / 2 + 26, 13, record ? GOLD : "#b77bff", 700);
  menuButtons().forEach(drawMenuButton);
  drawCenteredText("ENTER: REDEPLOY  ·  M: MAIN MENU", FH / 2 + 134, 10, "#7f8bb3", 500);
}
