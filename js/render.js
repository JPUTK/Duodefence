// render.js
// Everything that draws to the canvas.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");

// =====================================================================
// DRAWING
// =====================================================================
function hexPath(c, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ----- Static background (drawn once) -----
const bg = document.createElement("canvas");
bg.width = W; bg.height = FH;
(function () {
  const g = bg.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, FH);
  grd.addColorStop(0, "#060914"); grd.addColorStop(1, "#0b1024");
  g.fillStyle = grd; g.fillRect(0, 0, W, FH);

  [[0, 150, PRGB[0]], [MID, 810, PRGB[1]]].forEach(([x0, cx, rgb]) => {
    const r = g.createRadialGradient(cx, 300, 20, cx, 300, 520);
    r.addColorStop(0, "rgba(" + rgb + ",0.10)"); r.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = r; g.fillRect(x0, 0, MID, FH);
  });

  for (let i = 0; i < 170; i++) {
    g.fillStyle = "rgba(255,255,255," + (0.1 + Math.random() * 0.6) + ")";
    const s = Math.random() < 0.9 ? 1 : 2;
    g.fillRect(Math.random() * W, Math.random() * FH, s, s);
  }

  g.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    g.strokeStyle = "rgba(" + (x < MID ? PRGB[0] : PRGB[1]) + ",0.06)";
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, FH); g.stroke();
  }
  for (let y = 0; y <= FH; y += 40) {
    g.strokeStyle = "rgba(" + PRGB[0] + ",0.06)";
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(MID, y + 0.5); g.stroke();
    g.strokeStyle = "rgba(" + PRGB[1] + ",0.06)";
    g.beginPath(); g.moveTo(MID, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
  }
})();

// ----- Lanes (drawn once, layered over the rift so they act as bridges) -----
const laneLayer = document.createElement("canvas");
laneLayer.width = W; laneLayer.height = FH;
(function () {
  const g = laneLayer.getContext("2d");
  g.lineCap = "round"; g.lineJoin = "round";
  LANES.forEach(l => {
    const c = PCOL[l.guard];
    g.beginPath();
    l.path.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.shadowColor = c; g.shadowBlur = 18; g.globalAlpha = 0.5;
    g.strokeStyle = c; g.lineWidth = 40; g.stroke();
    g.shadowBlur = 0; g.globalAlpha = 1;
    g.strokeStyle = "#0d1326"; g.lineWidth = 35; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.04)"; g.lineWidth = 18; g.stroke();
  });
})();

function drawRift() {
  ctx.fillStyle = "#03020a";
  ctx.fillRect(MID - RIFT, 0, RIFT * 2, FH);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = "rgba(150,90,255," + (0.4 - k * 0.1) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 0; y <= FH; y += 8) {
      const x = MID + Math.sin(y * 0.03 + animT * (1.5 + k * 0.7) + k * 2) * (RIFT * 0.7 - k * 3);
      y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.shadowColor = "#9a5cff"; ctx.shadowBlur = 14;
  ctx.strokeStyle = "rgba(160,100,255,0.7)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MID - RIFT, 0); ctx.lineTo(MID - RIFT, FH);
  ctx.moveTo(MID + RIFT, 0); ctx.lineTo(MID + RIFT, FH);
  ctx.stroke();
  ctx.restore();
}

function drawLaneFlow() {
  ctx.lineWidth = 2;
  LANES.forEach((l, li) => {
    ctx.strokeStyle = PCOL[l.guard];
    ctx.globalAlpha = 0.4;
    for (let s = (animT * 45) % 36; s < l.len; s += 36) {
      const p = pointAt(l, s);
      if (p.y < -10 || p.y > FH + 10) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(3, 0); ctx.lineTo(-4, 6); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = PCOL[l.guard];
    ctx.font = "700 10px " + FONT; ctx.textAlign = l.align;
    ctx.fillText(l.label + " → P" + (l.target + 1) + " CORE", l.labelX, l.labelY);
    // surge warning glow on the lane under pressure
    const upcoming = state.queues[li].length ? surgeLane(state.wave) : surgeLane(state.wave + 1);
    if (upcoming === li) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(animT * 6);
      ctx.fillStyle = HOSTILE;
      ctx.fillText("⚠ SURGE", l.labelX, l.labelY + (l.labelY < 300 ? 14 : -14));
    }
  });
  ctx.globalAlpha = 1;
}

function drawPortal(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = "rgba(255,150,60," + (0.55 - k * 0.15) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 + k * 5 + Math.sin(animT * 4 + k) * 2, 6 + k * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(i) {
  const { x, y } = CORES[i], c = PCOL[i], p = state.players[i];
  const pct = p.core / CORE_MAX, pulse = 0.5 + 0.5 * Math.sin(animT * 3 + i);

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = c; ctx.shadowBlur = 14 + pulse * 14;
  ctx.fillStyle = "#0a1022"; ctx.strokeStyle = c; ctx.lineWidth = 2;
  hexPath(ctx, 26, Math.PI / 6); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 17);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, c); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 13 + pulse * 3, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(animT * 0.8 * (i ? -1 : 1));
  ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.arc(0, 0, 32, k * 2.094, k * 2.094 + 1.2); ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
  const hc = pct > 0.5 ? c : pct > 0.25 ? "#ffb03b" : "#ff4040";
  ctx.strokeStyle = hc; ctx.shadowColor = hc; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = c; ctx.font = "700 10px " + FONT; ctx.textAlign = "center";
  ctx.fillText("P" + (i + 1) + " CORE", x, y + 56);
}

function drawTower(t, ghost) {
  const c = PCOL[t.owner], hybrid = isHybrid(t);
  ctx.save();
  ctx.translate(t.x, t.y);
  if (ghost) ctx.globalAlpha = 0.55;

  // Base plate
  ctx.fillStyle = "#0c1224"; ctx.lineWidth = 2;
  ctx.shadowColor = hybrid ? GOLD : c; ctx.shadowBlur = ghost ? 0 : (hybrid ? 14 : 8);
  if (hybrid) {
    ctx.strokeStyle = GOLD; hexPath(ctx, 19, Math.PI / 6); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    hexPath(ctx, 14, Math.PI / 6); ctx.stroke();
  } else {
    ctx.strokeStyle = c; hexPath(ctx, 15, Math.PI / 6); ctx.fill(); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Elite ring
  if (!ghost && isElite(t)) {
    ctx.save();
    ctx.rotate(animT * 1.2);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  switch (t.type) {
    case "laser":
      ctx.rotate(t.angle);
      ctx.fillStyle = "#d8f6ff"; ctx.fillRect(4, -2, 16, 4);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case "plasma":
      ctx.rotate(t.angle);
      ctx.fillStyle = "#56607e"; ctx.fillRect(2, -6, 16, 4); ctx.fillRect(2, 2, 16, 4);
      ctx.fillStyle = GOLD; ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = c; ctx.fillRect(-3, -3, 6, 6);
      break;
    case "cryo":
      ctx.rotate(animT * 1.5);
      ctx.strokeStyle = "#bff6ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke();
      }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    case "ion":
      ctx.rotate(t.angle);
      ctx.fillStyle = GOLD; ctx.fillRect(0, -8, 20, 3); ctx.fillRect(0, 5, 20, 3);
      ctx.fillStyle = "#e6d4ff"; ctx.fillRect(4, -2.5, 24, 5);
      ctx.fillStyle = "#b77bff"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case "frost":
      ctx.save(); ctx.rotate(-animT * 2);
      ctx.strokeStyle = "#bff6ff"; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, 12, k * 2.094, k * 2.094 + 1.2); ctx.stroke(); }
      ctx.restore();
      ctx.rotate(t.angle);
      ctx.fillStyle = "#d8f6ff"; ctx.fillRect(4, -2, 20, 4);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9ff3ff"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case "nova":
      ctx.rotate(t.angle);
      ctx.fillStyle = "#56607e"; ctx.fillRect(2, -5, 20, 10);
      ctx.fillStyle = GOLD; ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = "#9ff3ff"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      break;
  }
  ctx.restore();

  if (ghost) return;
  if (t.flash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (hybrid) {
    ctx.fillStyle = GOLD; ctx.font = "900 9px " + FONT; ctx.textAlign = "center";
    ctx.fillText("★", t.x, t.y + 30);
  } else {
    ctx.fillStyle = c;
    for (let k = 0; k < t.level; k++) ctx.fillRect(t.x - 9 + k * 7, t.y + 19, 4, 3);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(t.x - 11, t.y + 24, 22, 2);
    ctx.fillStyle = GOLD; ctx.fillRect(t.x - 11, t.y + 24, 22 * t.xp / XP_ELITE, 2);
  }
}

function drawEnemy(e) {
  const r = e.r, edge = e.hit > 0 ? "#ffffff" : HOSTILE;
  const boss = e.kind === "carrier" || e.kind === "juggernaut";
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(boss ? e.spin : e.a);
  ctx.shadowColor = HOSTILE; ctx.shadowBlur = 10;
  ctx.fillStyle = "#1e130b"; ctx.strokeStyle = edge; ctx.lineWidth = 2;

  ctx.beginPath();
  if (e.kind === "scout") {
    ctx.moveTo(r, 0); ctx.lineTo(-r, -r * 0.8); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r * 0.8); ctx.closePath();
  } else if (e.kind === "grunt") {
    ctx.moveTo(r, 0); ctx.lineTo(0, -r); ctx.lineTo(-r, 0); ctx.lineTo(0, r); ctx.closePath();
  } else if (e.kind === "carrier") {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else {
    hexPath(ctx, r, 0);
  }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  if (e.kind === "tank") {
    ctx.strokeStyle = "rgba(255,200,120,0.45)";
    ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
  }
  if (e.kind === "juggernaut") {
    ctx.strokeStyle = edge;
    hexPath(ctx, r * 0.55, Math.PI / 6); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); ctx.stroke();
    }
  }
  if (e.kind === "carrier") {
    ctx.fillStyle = edge;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = edge;
  ctx.beginPath(); ctx.arc(boss ? 0 : r * 0.25, 0, boss ? 5 : 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (e.brittleT > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.slowT > 0) {
    ctx.strokeStyle = "rgba(159,243,255,0.75)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2); ctx.stroke();
  }
  if (e.hp < e.maxHp) {
    const w = Math.max(20, r * 2.4);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 3);
    ctx.fillStyle = HOSTILE; ctx.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp) / e.maxHp, 3);
  }
}

function drawPanel(i) {
  const P = PANELS[i], c = PCOL[i], p = state.players[i];
  ctx.save();
  ctx.fillStyle = "rgba(7,10,24,0.92)"; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
  ctx.shadowColor = c; ctx.shadowBlur = 10;
  roundRect(ctx, P.x, P.y, P.w, P.h, 8); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = "left";
  ctx.fillStyle = c; ctx.font = "900 13px " + FONT;
  ctx.fillText("PLAYER " + (i + 1), P.x + 12, P.y + 24);
  ctx.fillStyle = "#e8ecff"; ctx.font = "700 13px " + FONT;
  ctx.fillText(p.credits + " CR", P.x + 12, P.y + 46);
  ctx.fillStyle = p.core / CORE_MAX > 0.25 ? "#aab4d8" : "#ff5a5a"; ctx.font = "500 11px " + FONT;
  ctx.fillText("CORE " + p.core + " / " + CORE_MAX, P.x + 12, P.y + 66);

  panelButtons(i).forEach((b, k) => {
    const isGive = b.type === "give";
    const sel = !isGive && b.type === p.sel;
    const cost = isGive ? GIVE_AMOUNT : TYPES[b.type].cost;
    ctx.globalAlpha = p.credits >= cost ? 1 : 0.45;
    ctx.fillStyle = sel ? "rgba(" + PRGB[i] + ",0.22)" : isGive ? "rgba(255,211,77,0.06)" : "rgba(255,255,255,0.04)";
    ctx.strokeStyle = sel ? c : isGive ? "rgba(255,211,77,0.5)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = sel ? 2 : 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.stroke();

    // mini icon
    if (!isGive) {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + 18);
      ctx.scale(0.7, 0.7);
      drawIcon(b.type, i);
      ctx.restore();
    } else {
      ctx.fillStyle = GOLD; ctx.font = "900 16px " + FONT; ctx.textAlign = "center";
      ctx.fillText("⇄", b.x + b.w / 2, b.y + 24);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = sel ? "#ffffff" : "#c6cdea";
    ctx.font = "700 9px " + FONT;
    ctx.fillText(isGive ? "GIVE" : TYPES[b.type].name, b.x + b.w / 2, b.y + 41);
    ctx.fillStyle = isGive ? GOLD : c;
    ctx.font = "500 9px " + FONT;
    ctx.fillText(cost + " CR", b.x + b.w / 2, b.y + 53);
    if (!isGive) {
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "500 8px " + FONT; ctx.textAlign = "right";
      ctx.fillText(KEYS[i][k], b.x + b.w - 5, b.y + 10);
    }
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function drawIcon(type, owner) {
  drawTower({ type, owner, level: 1, x: 0, y: 0, angle: -Math.PI / 4, flash: 0, xp: 0 }, true);
}

function drawTooltip(text, x, y, color) {
  ctx.font = "500 11px " + FONT;
  const w = ctx.measureText(text).width + 16;
  const bx = Math.max(6, Math.min(W - w - 6, x - w / 2));
  ctx.fillStyle = "rgba(7,10,24,0.94)"; ctx.strokeStyle = color; ctx.lineWidth = 1;
  roundRect(ctx, bx, y - 14, w, 22, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e8ecff"; ctx.textAlign = "left";
  ctx.fillText(text, bx + 8, y + 1);
}

function drawMergeSelection() {
  state.players.forEach(p => {
    const a = p.mergeSel;
    if (!a) return;
    const pulse = 0.5 + 0.5 * Math.sin(animT * 6);
    ctx.save();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(a.x, a.y, MERGE_RANGE, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 2 + pulse * 2;
    ctx.shadowColor = GOLD; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(a.x, a.y, 24, 0, Math.PI * 2); ctx.stroke();
    for (const o of state.towers) {
      if (!canMerge(a, o)) continue;
      ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -animT * 30;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(o.x, o.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(o.x, o.y, 24, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  });
}

function drawHover() {
  if (state.over || mouse.x < 0) return;
  const ph = panelHit(mouse.x, mouse.y);
  if (ph) {
    if (ph.btn) {
      const text = ph.btn.type === "give" ? "Send " + GIVE_AMOUNT + " credits to your ally" : TYPES[ph.btn.type].desc;
      drawTooltip(text, ph.btn.x + ph.btn.w / 2, FH - 14, PCOL[ph.player]);
    }
    return;
  }
  if (mouse.y > FH) return;
  const owner = sideOf(mouse.x);
  if (owner < 0) return;
  const p = state.players[owner];

  const t = towerAt(mouse.x, mouse.y);
  if (t) {
    const st = TYPES[t.type].lv[t.level - 1];
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(t.x, t.y, st.range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const sellTxt = "Right-click: sell " + Math.floor(t.spent * 0.6);
    let text;
    if (p.mergeSel && canMerge(p.mergeSel, t)) {
      text = "Merge → " + TYPES[hybridFor(p.mergeSel.type, t.type)].name + " · " + MERGE_COST + " CR";
    } else if (isHybrid(t)) {
      text = TYPES[t.type].name + " · " + TYPES[t.type].desc;
    } else if (t.level < 3) {
      text = TYPES[t.type].name + " L" + t.level + " · Click: upgrade " + upgradeCost(t) + " · " + sellTxt;
    } else if (isElite(t)) {
      text = "ELITE " + TYPES[t.type].name + " · Click to merge (" + MERGE_COST + " CR) · " + sellTxt;
    } else {
      text = TYPES[t.type].name + " L3 · XP " + Math.floor(t.xp) + "/" + XP_ELITE + " to ELITE · " + sellTxt;
    }
    drawTooltip(text, t.x, t.y - 34, isHybrid(t) || isElite(t) ? GOLD : PCOL[t.owner]);
    return;
  }
  if (p.mergeSel) return;

  const T = TYPES[p.sel];
  const ok = canBuild(mouse.x, mouse.y, owner);
  const afford = p.credits >= T.cost;
  ctx.fillStyle = ok && afford ? "rgba(255,255,255,0.07)" : "rgba(255,60,60,0.12)";
  ctx.strokeStyle = ok && afford ? PCOL[owner] : "rgba(255,80,80,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(mouse.x, mouse.y, T.lv[0].range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (ok) drawTower({ type: p.sel, owner, level: 1, x: mouse.x, y: mouse.y, angle: owner ? Math.PI : 0, flash: 0, xp: 0 }, true);
}

function drawCenteredText(text, y, size, color, weight = 700) {
  ctx.font = weight + " " + size + "px " + FONT;
  ctx.fillStyle = color; ctx.textAlign = "center";
  ctx.fillText(text, MID, y);
}

function draw() {
  ctx.save();
  if (state.shake > 0) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

  ctx.drawImage(bg, 0, 0);
  drawRift();
  ctx.drawImage(laneLayer, 0, 0);
  drawLaneFlow();
  drawPortal(PATH_A[0][0], 3);
  drawPortal(PATH_B[0][0], FH - 3);

  for (const f of state.fields) {
    ctx.globalAlpha = Math.min(1, f.life / f.max * 2) * 0.5;
    ctx.fillStyle = "rgba(159,243,255,0.18)"; ctx.strokeStyle = "#9ff3ff"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawCore(0); drawCore(1);
  drawMergeSelection();
  for (const t of state.towers) drawTower(t, false);
  for (const e of state.enemies) drawEnemy(e);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const b of state.beams) {
    ctx.strokeStyle = b.c; ctx.globalAlpha = 0.35; ctx.lineWidth = b.w + 5;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1, b.w - 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const s of state.shots) {
    ctx.fillStyle = s.color; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.fieldDps ? 10 : 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of state.pulses) {
    const k = 1 - p.life / p.max;
    ctx.strokeStyle = p.c; ctx.globalAlpha = p.life / p.max; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, Math.PI * 2); ctx.stroke();
  }
  for (const p of state.parts) {
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();

  ctx.textAlign = "center";
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color; ctx.font = "700 11px " + FONT;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore(); // end screen shake

  // HUD strip
  ctx.fillStyle = "#05070f"; ctx.fillRect(0, FH, W, H - FH);
  ctx.strokeStyle = "#2a3560"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, FH + 0.5); ctx.lineTo(W, FH + 0.5); ctx.stroke();
  drawPanel(0); drawPanel(1);

  // Wave readout
  drawCenteredText("WAVE " + state.wave, 22, 14, "#e8ecff", 900);
  const pending = state.queues[0].length + state.queues[1].length;
  const status = pending ? "INCOMING " + pending : "NEXT IN " + Math.max(0, Math.ceil(state.nextWaveIn)) + "s";
  drawCenteredText(status, 38, 10, "rgba(232,236,255,0.7)", 500);

  drawHover();

  if (state.banner) {
    ctx.globalAlpha = Math.min(1, state.banner.life);
    ctx.fillStyle = "rgba(3,5,12,0.55)"; ctx.fillRect(0, FH / 2 - 26, W, 46);
    drawCenteredText(state.banner.text, FH / 2 + 6, 22, state.banner.color, 900);
    ctx.globalAlpha = 1;
  }

  if (state.paused && !state.over) {
    ctx.fillStyle = "rgba(3,5,12,0.55)"; ctx.fillRect(0, 0, W, FH);
    drawCenteredText("PAUSED", FH / 2, 36, "#e8ecff", 900);
    drawCenteredText("Press Space to resume", FH / 2 + 28, 12, "#9aa5c9", 500);
  }

  if (state.over) {
    ctx.fillStyle = "rgba(3,5,12,0.8)"; ctx.fillRect(0, 0, W, H);
    drawCenteredText("CORE BREACHED", FH / 2 - 30, 40, "#ff5a5a", 900);
    drawCenteredText("You held the line together for " + state.wave + " waves", FH / 2 + 8, 16, "#e8ecff", 500);
    drawCenteredText("BEST: WAVE " + best, FH / 2 + 34, 13, "#b77bff", 700);
    drawCenteredText("Click to redeploy", FH / 2 + 64, 12, "#9aa5c9", 500);
  }
}
