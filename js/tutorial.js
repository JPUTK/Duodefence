// tutorial.js
// Interactive how-to-play. Each step either waits for the players to do
// something (build, upgrade, give) or waits for them to click NEXT.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

const LEFT_FIELD = { x: 0, y: 0, w: MID - RIFT, h: FH };
const RIGHT_FIELD = { x: MID + RIFT, y: 0, w: W - MID - RIFT, h: FH };

// card: where the instruction box sits so it doesn't cover what you need to click
//   "center" | "left" | "right"
// dim: darken everything except the highlighted areas
const TUT_STEPS = [
  {
    title: "WELCOME TO THE RIFT",
    text: "Two players share this screen. PLAYER 1 (cyan) builds on the left. PLAYER 2 (magenta) builds on the right. The rift down the middle splits your territory.",
    card: "center", dim: true
  },
  {
    title: "THE TWIST",
    text: "The lane on YOUR side carries drones heading for your ALLY'S core, not yours. Your turrets only shoot drones on your own lane. You keep each other alive. If either core falls, you both lose.",
    card: "right", dim: true, highlight: () => [LEFT_FIELD]
  },
  {
    title: "PLAYER 1: BUILD A TURRET",
    text: "Pick LASER in your panel (or press 1), then click open ground next to the Swarm Lane. The circle shows the turret's range. Red means you can't build there.",
    card: "right", dim: true, highlight: () => [LEFT_FIELD, PANELS[0]],
    check: () => state.towers.some(t => t.owner === 0)
  },
  {
    title: "PLAYER 2: YOUR TURN",
    text: "Pick PLASMA (or press 9) and build next to the Heavy Lane. Plasma bolts splash damage and punch through armor, which is perfect for the slow, armored drones on your side.",
    card: "left", dim: true, highlight: () => [RIGHT_FIELD, PANELS[1]],
    check: () => state.towers.some(t => t.owner === 1)
  },
  {
    title: "INCOMING!",
    text: "Here comes a practice wave. Watch your turrets protect each other's cores. Every drone you destroy earns you credits.",
    card: "center", dim: false,
    onEnter: () => {
      state.wave = 1;
      for (let li = 0; li < 2; li++) {
        for (let i = 0; i < 5; i++) state.queues[li].push(makeSpec("grunt", 40, 6, 48 * PROFILES[li].spd * LANES[li].speedScale, 1));
        state.intervals[li] = 1.2;
        state.timers[li] = 0.5;
      }
    },
    check: () => !state.queues[0].length && !state.queues[1].length && !state.enemies.length
  },
  {
    title: "UPGRADE",
    text: "Click one of your turrets to upgrade it, up to level 3. Upgrades hit harder and reach further. Either player can try it now.",
    card: "center", dim: false,
    check: () => state.towers.some(t => t.level >= 2)
  },
  {
    title: "SHARE CREDITS",
    text: "Each side faces different drones, and every 4th wave a SURGE slams one lane. When your ally is struggling, press GIVE to send them 25 credits. Try it now.",
    card: "center", dim: true, highlight: () => [panelButtons(0)[3], panelButtons(1)[3]],
    check: () => state.gives > 0
  },
  {
    title: "XP & MERGING",
    text: "Turrets earn XP as they deal damage. A level 3 turret with full XP turns ELITE and gets a gold ring. Click an elite turret, then a different-type elite turret of yours nearby, to merge them into a powerful hybrid for 200 credits.",
    card: "center", dim: true
  },
  {
    title: "WATCH OUT FOR",
    text: "⚠ SURGE warnings appear on a lane one wave early. Every 5th wave brings bosses: a Brood Carrier that bursts into scouts, and an armored Juggernaut. Right-click a turret to sell it for 60% back.",
    card: "center", dim: true
  },
  {
    title: "YOU'RE READY",
    text: "That's everything. Hold the line together and see how many waves you can survive.",
    card: "center", dim: true, final: true
  }
];

let tut = { step: 0, doneT: 0 };

function startTutorial() {
  reset();
  state.players.forEach(p => { p.credits = 250; });
  state.nextWaveIn = Infinity; // waves only come when the tutorial sends them
  state.gives = 0;
  tut = { step: 0, doneT: 0 };
  setScreen("tutorial");
  cvs.style.cursor = "crosshair";
  Sound.setMode("game");
  enterStep();
}

function enterStep() {
  const s = TUT_STEPS[tut.step];
  tut.doneT = 0;
  if (s.onEnter) s.onEnter();
}

function nextStep() {
  if (tut.step < TUT_STEPS.length - 1) { tut.step++; enterStep(); }
}

function updateTutorial(dt) {
  update(dt);
  // Practice mode: cores can't fall during the tutorial
  state.players.forEach(p => { p.core = Math.max(p.core, 10); });
  state.over = false;
  state.banner = null;

  const s = TUT_STEPS[tut.step];
  if (!s.check) return;
  if (tut.doneT > 0) {
    tut.doneT -= dt;
    if (tut.doneT <= 0) nextStep();
  } else if (s.check()) {
    tut.doneT = 0.9; // brief pause so players see the checkmark
    Sound.play("give");
  }
}

// ----- Card layout -----
function wrapText(text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function tutCard() {
  const s = TUT_STEPS[tut.step];
  const w = 360, pad = 18;
  ctx.font = "500 13px " + FONT;
  const lines = wrapText(s.text, w - pad * 2);
  const h = pad + 22 + 10 + lines.length * 19 + 16 + 36 + pad;
  const x = s.card === "left" ? 50 : s.card === "right" ? W - 50 - w : MID - w / 2;
  const y = s.card === "center" ? Math.max(70, FH / 2 - h / 2 - 20) : 140;
  const by = y + h - pad - 36;
  const buttons = [];
  if (s.final) {
    buttons.push({ id: "tut-start", label: "START GAME", x: x + w - pad - 150, y: by, w: 150, h: 36, primary: true });
    buttons.push({ id: "tut-menu", label: "MAIN MENU", x: x + pad, y: by, w: 140, h: 36 });
  } else {
    if (!s.check) buttons.push({ id: "tut-next", label: "NEXT", x: x + w - pad - 110, y: by, w: 110, h: 36, primary: true });
    buttons.push({ id: "tut-skip", label: "SKIP TUTORIAL", x: x + pad, y: by + 8, w: 120, h: 20, link: true });
  }
  return { x, y, w, h, pad, lines, buttons };
}

// Returns true if the click was used by the tutorial card.
function tutorialClick(x, y) {
  const card = tutCard();
  const b = card.buttons.find(b => inRect(x, y, b));
  if (b) {
    Sound.play("ui");
    if (b.id === "tut-next") nextStep();
    else if (b.id === "tut-start") startGame();
    else if (b.id === "tut-menu" || b.id === "tut-skip") goToMenu();
    return true;
  }
  return inRect(x, y, card); // clicks on the card itself don't build turrets
}

function tutorialButtonAt(x, y) {
  return tutCard().buttons.find(b => inRect(x, y, b)) || null;
}

// ----- Drawing -----
function drawTutorial() {
  const s = TUT_STEPS[tut.step];
  const holes = s.highlight ? s.highlight() : [];
  const pulse = 0.5 + 0.5 * Math.sin(animT * 4);

  if (s.dim) {
    ctx.save();
    ctx.fillStyle = "rgba(3,5,12,0.62)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    for (const r of holes) ctx.rect(r.x + r.w, r.y, -r.w, r.h); // reversed rect = cut-out
    ctx.fill();
    ctx.restore();
  }
  for (const r of holes) {
    ctx.save();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.shadowColor = GOLD; ctx.shadowBlur = 12;
    roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6); ctx.stroke();
    ctx.restore();
  }

  const c = tutCard();
  ctx.save();
  ctx.fillStyle = "rgba(7,10,24,0.96)";
  ctx.strokeStyle = "#b77bff"; ctx.lineWidth = 1.5;
  ctx.shadowColor = "#9a5cff"; ctx.shadowBlur = 20;
  roundRect(ctx, c.x, c.y, c.w, c.h, 10); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  const done = tut.doneT > 0;
  ctx.textAlign = "left";
  ctx.fillStyle = done ? "#5dff9d" : GOLD;
  ctx.font = "900 15px " + FONT;
  ctx.fillText((done ? "✓ " : "") + s.title, c.x + c.pad, c.y + c.pad + 15);
  ctx.textAlign = "right"; ctx.fillStyle = "#7f8bb3"; ctx.font = "500 10px " + FONT;
  ctx.fillText((tut.step + 1) + " / " + TUT_STEPS.length, c.x + c.w - c.pad, c.y + c.pad + 13);

  ctx.textAlign = "left"; ctx.fillStyle = "#dfe6ff"; ctx.font = "500 13px " + FONT;
  c.lines.forEach((line, i) => ctx.fillText(line, c.x + c.pad, c.y + c.pad + 46 + i * 19));

  if (s.check && !done) {
    ctx.fillStyle = "rgba(255,211,77," + (0.5 + pulse * 0.5) + ")";
    ctx.font = "700 10px " + FONT; ctx.textAlign = "right";
    ctx.fillText("WAITING FOR YOU…", c.x + c.w - c.pad, c.y + c.h - c.pad - 10);
  }
  ctx.restore();

  for (const b of c.buttons) {
    if (b.link) {
      const hover = inRect(mouse.x, mouse.y, b);
      ctx.fillStyle = hover ? "#dfe6ff" : "#7f8bb3";
      ctx.font = "700 10px " + FONT; ctx.textAlign = "left";
      ctx.fillText(b.label, b.x, b.y + 13);
    } else {
      drawMenuButton(b);
    }
  }
}
