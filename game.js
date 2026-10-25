// game.js
// Game state and rules: waves, damage, the update step, and player actions.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

let state, speedMul = 1, animT = 0, best = 0;
let mouse = { x: -100, y: -100 };
try { best = parseInt(localStorage.getItem("riftBest") || "0", 10) || 0; } catch (e) {}

function reset() {
  state = {
    players: [
      { credits: 150, core: CORE_MAX, sel: "laser", mergeSel: null },
      { credits: 150, core: CORE_MAX, sel: "laser", mergeSel: null }
    ],
    wave: 0, queues: [[], []], timers: [0, 0], intervals: [1, 1], nextWaveIn: 15,
    enemies: [], towers: [], beams: [], shots: [], pulses: [], fields: [], parts: [], floaters: [],
    banner: null, shake: 0, over: false, paused: false, gives: 0
  };
}

// =====================================================================
// HELPERS
// =====================================================================
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sideOf(x) {
  if (x < MID - RIFT) return 0;
  if (x > MID + RIFT) return 1;
  return -1;
}

function inRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function canBuild(x, y, owner) {
  if (owner === 0 && x > MID - RIFT - 16) return false;
  if (owner === 1 && x < MID + RIFT + 16) return false;
  if (x < 18 || x > W - 18 || y < 18 || y > FH - 18) return false;
  if (x > MID - 100 && x < MID + 100 && y < 56) return false; // wave readout
  for (const l of LANES) for (const g of l.segs) {
    if (distToSegment(x, y, g.ax, g.ay, g.bx, g.by) < 36) return false;
  }
  for (const c of CORES) if (Math.hypot(x - c.x, y - c.y) < 56) return false;
  for (const t of state.towers) if (Math.hypot(x - t.x, y - t.y) < 34) return false;
  return true;
}

function towerAt(x, y) {
  return state.towers.find(t => Math.hypot(t.x - x, t.y - y) < 18);
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 140, life = 0.35 + Math.random() * 0.45;
    state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 1.5 + Math.random() * 2 });
  }
}

function floater(x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.2 });
}

// =====================================================================
// WAVES
// =====================================================================
function makeSpec(kind, hp, rew, spd, w) {
  const k = KINDS[kind];
  return {
    kind, hp: Math.max(1, Math.round(hp)), rew: Math.max(1, Math.round(rew)), spd: spd * k.spd,
    armor: k.armor + (k.armor ? Math.floor(w / 4) : 0), core: k.core, r: k.r
  };
}

function buildWave(w) {
  const surge = surgeLane(w);
  const base = 6 + 2 * w;
  const hpUnit = 30 * Math.pow(1.2, w - 1);
  const rewUnit = 4 + w / 2;
  const spd = Math.min(42 + 2.5 * w, 100);
  const duration = 0.75 * base;

  PROFILES.forEach((pr, li) => {
    const mult = li === surge ? 1.5 : 1;
    const n = Math.max(3, Math.round(base * pr.count * mult));
    const kinds = [];
    for (let i = 0; i < n; i++) kinds.push(pr.mix(w, i));
    const weight = kinds.reduce((s, k) => s + KINDS[k].hp, 0);
    const hpBudget = hpUnit * base * mult, rewBudget = rewUnit * base * mult;
    const q = kinds.map(k => makeSpec(k, hpBudget * KINDS[k].hp / weight, rewBudget * KINDS[k].hp / weight, spd * pr.spd, w));
    if (w % 5 === 0) {
      const b = KINDS[pr.boss];
      q.push(makeSpec(pr.boss, hpUnit * b.hp, rewUnit * b.rew, spd * pr.spd, w));
    }
    state.queues[li].push(...q);
    state.intervals[li] = duration / q.length;
  });
  return surge;
}

function startWave(early) {
  if (state.over) return;
  if (early && state.nextWaveIn > 1) {
    const bonus = Math.ceil(state.nextWaveIn);
    state.players.forEach((p, i) => {
      p.credits += bonus;
      floater(CORES[i].x, CORES[i].y - 52, "+" + bonus + " EARLY", PCOL[i]);
    });
  }
  state.wave++;
  const surge = buildWave(state.wave);
  state.nextWaveIn = 25;
  let text = "WAVE " + state.wave, color = "#ffffff";
  if (surge >= 0) { text += " · SURGE ON " + LANES[surge].label; color = PCOL[surge]; }
  if (state.wave % 5 === 0) { text += " · BOSSES"; color = HOSTILE; }
  state.banner = { text, color, life: 2.4 };
  Sound.play(state.wave % 5 === 0 ? "boss" : surge >= 0 ? "surge" : "wave");
}

function spawnEnemy(li, spec, trav = 0) {
  const p = pointAt(LANES[li], trav);
  state.enemies.push({
    ...spec, lane: li, x: p.x, y: p.y, a: p.a, trav, maxHp: spec.hp,
    slowT: 0, slowF: 1, brittleT: 0, hit: 0, spin: Math.random() * 6, dead: false
  });
}

function applySlow(e, factor, dur) {
  e.slowF = e.slowT > 0 ? Math.min(e.slowF, factor) : factor;
  e.slowT = Math.max(e.slowT, dur);
}

// Deals damage from a turret (src). Returns damage actually dealt.
function hurt(e, dmg, src, pierce) {
  if (e.dead) return 0;
  let d = pierce ? dmg : Math.max(1, dmg - e.armor);
  if (e.brittleT > 0) d *= 1.4;
  d = Math.min(d, e.hp);
  e.hp -= d;
  e.hit = 0.06;
  if (src && !isHybrid(src)) src.xp = Math.min(XP_ELITE, src.xp + d);
  if (e.hp <= 0.001) {
    e.dead = true;
    const owner = src ? src.owner : LANES[e.lane].guard;
    state.players[owner].credits += e.rew;
    Sound.play(e.r > 15 ? "bigkill" : "kill", e.x);
    floater(e.x, e.y - 14, "+" + e.rew, PCOL[owner]);
    burst(e.x, e.y, HOSTILE, e.r > 15 ? 45 : 12);
    if (e.kind === "carrier") {
      for (let k = 0; k < 6; k++) {
        spawnEnemy(e.lane, {
          kind: "scout", hp: Math.max(1, Math.round(e.maxHp * 0.07)), rew: 2,
          spd: e.spd * 2.3, armor: 0, core: 1, r: 8
        }, Math.max(0, e.trav - k * 12));
      }
      floater(e.x, e.y - 30, "BROOD RELEASED", HOSTILE);
    }
  }
  return d;
}

// =====================================================================
// UPDATE
// =====================================================================
function update(dt) {
  if (state.over || state.paused) return;

  state.nextWaveIn -= dt;
  if (state.nextWaveIn <= 0) startWave(false);

  for (let li = 0; li < 2; li++) {
    if (!state.queues[li].length) continue;
    state.timers[li] -= dt;
    if (state.timers[li] <= 0) {
      spawnEnemy(li, state.queues[li].shift());
      state.timers[li] = state.intervals[li];
    }
  }

  // --- Enemies move along their lane ---
  for (const e of state.enemies) {
    if (e.dead) continue;
    const lane = LANES[e.lane];
    if (e.slowT > 0) e.slowT -= dt; else e.slowF = 1;
    if (e.brittleT > 0) e.brittleT -= dt;
    e.trav += e.spd * (e.slowT > 0 ? e.slowF : 1) * dt;
    const p = pointAt(lane, e.trav);
    e.x = p.x; e.y = p.y; e.a = p.a;
    e.spin += dt * 2; e.hit -= dt;
    if (e.trav >= lane.len) {
      e.dead = true;
      const pl = state.players[lane.target];
      pl.core = Math.max(0, pl.core - e.core);
      Sound.play("corehit", CORES[lane.target].x);
      state.shake = Math.max(state.shake, 6 + e.core * 2);
      burst(e.x, e.y, PCOL[lane.target], 18);
      floater(e.x, e.y - 50, "-" + e.core + " CORE", "#ff5a5a");
      if (pl.core <= 0) {
        state.over = true;
        Sound.play("gameover");
        Sound.setMode("over");
        if (state.wave > best) {
          best = state.wave;
          try { localStorage.setItem("riftBest", String(best)); } catch (err) {}
        }
      }
    }
  }

  // --- Turrets fire (only at drones on the lane they guard) ---
  for (const t of state.towers) {
    const st = TYPES[t.type].lv[t.level - 1];
    t.cool -= dt; t.flash -= dt;
    let target = null;
    const inRange = [];
    for (const e of state.enemies) {
      if (e.dead || LANES[e.lane].guard !== t.owner) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) > st.range) continue;
      inRange.push(e);
      if (!target || e.trav > target.trav) target = e; // furthest along
    }
    if (target && t.type !== "cryo") t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cool > 0 || !target) continue;

    t.cool = 1 / st.rate;
    t.flash = 0.08;
    const mx = t.x + Math.cos(t.angle) * 18, my = t.y + Math.sin(t.angle) * 18;

    switch (t.type) {
      case "laser":
        Sound.play("laser", t.x);
        hurt(target, st.dmg, t);
        state.beams.push({ x1: mx, y1: my, x2: target.x, y2: target.y, c: PCOL[t.owner], w: 1 + t.level, life: 0.07 });
        break;
      case "plasma":
        Sound.play("plasma", t.x);
        state.shots.push({ x: mx, y: my, tgt: target, tx: target.x, ty: target.y, dmg: st.dmg, splash: st.splash, src: t, spd: 360, color: GOLD });
        break;
      case "cryo":
        Sound.play("cryo", t.x);
        for (const e of inRange) {
          applySlow(e, st.slow, 1.4);
          t.xp = Math.min(XP_ELITE, t.xp + 3); // cryo also learns from slowing
          hurt(e, st.dmg, t, true);
        }
        state.pulses.push({ x: t.x, y: t.y, r0: 12, r1: st.range, life: 0.45, max: 0.45, c: "#9ff3ff" });
        break;
      case "ion": {
        Sound.play("ion", t.x);
        const ex = t.x + Math.cos(t.angle) * st.range, ey = t.y + Math.sin(t.angle) * st.range;
        for (const e of state.enemies) {
          if (e.dead || LANES[e.lane].guard !== t.owner) continue;
          if (distToSegment(e.x, e.y, mx, my, ex, ey) <= e.r + 6) hurt(e, st.dmg, t, true);
        }
        state.beams.push({ x1: mx, y1: my, x2: ex, y2: ey, c: "#b77bff", w: 5, life: 0.12 });
        break;
      }
      case "frost":
        Sound.play("frost", t.x);
        hurt(target, st.dmg, t);
        if (!target.dead) { applySlow(target, st.slow, 1.2); target.brittleT = 1.5; }
        state.beams.push({ x1: mx, y1: my, x2: target.x, y2: target.y, c: "#9ff3ff", w: 3, life: 0.07 });
        break;
      case "nova":
        Sound.play("nova", t.x);
        state.shots.push({ x: mx, y: my, tgt: target, tx: target.x, ty: target.y, dmg: st.dmg, splash: st.splash,
          slow: st.slow, fieldDps: st.fieldDps, src: t, spd: 320, color: "#9ff3ff" });
        break;
    }
  }

  // --- Bolts and bombs ---
  for (const s of state.shots) {
    if (s.tgt && !s.tgt.dead) { s.tx = s.tgt.x; s.ty = s.tgt.y; }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.spd * dt;
    if (d <= step) {
      s.done = true;
      const owner = s.src.owner;
      for (const e of state.enemies) {
        if (e.dead || LANES[e.lane].guard !== owner) continue;
        if (Math.hypot(e.x - s.tx, e.y - s.ty) > s.splash) continue;
        if (s.slow) applySlow(e, s.slow, 2);
        hurt(e, s.dmg, s.src);
      }
      burst(s.tx, s.ty, s.color, 16);
      Sound.play("boom", s.tx);
      state.pulses.push({ x: s.tx, y: s.ty, r0: 6, r1: s.splash, life: 0.25, max: 0.25, c: s.color });
      if (s.fieldDps) state.fields.push({ x: s.tx, y: s.ty, r: 60, life: 2.5, max: 2.5, dps: s.fieldDps, src: s.src });
    } else {
      s.x += dx / d * step; s.y += dy / d * step;
    }
  }

  // --- Freezing fields ---
  for (const f of state.fields) {
    f.life -= dt;
    for (const e of state.enemies) {
      if (e.dead || LANES[e.lane].guard !== f.src.owner) continue;
      if (Math.hypot(e.x - f.x, e.y - f.y) > f.r) continue;
      applySlow(e, 0.5, 0.3);
      hurt(e, f.dps * dt, f.src, true);
    }
  }

  // --- Effects ---
  for (const b of state.beams) b.life -= dt;
  for (const p of state.pulses) p.life -= dt;
  for (const p of state.parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
    p.life -= dt;
  }
  for (const f of state.floaters) { f.y -= 28 * dt; f.life -= dt; }
  if (state.banner) { state.banner.life -= dt; if (state.banner.life <= 0) state.banner = null; }
  state.shake = Math.max(0, state.shake - 30 * dt);

  state.enemies = state.enemies.filter(e => !e.dead);
  state.shots = state.shots.filter(s => !s.done);
  state.fields = state.fields.filter(f => f.life > 0);
  state.beams = state.beams.filter(b => b.life > 0);
  state.pulses = state.pulses.filter(p => p.life > 0);
  state.parts = state.parts.filter(p => p.life > 0);
  state.floaters = state.floaters.filter(f => f.life > 0);
}

// =====================================================================
// ACTIONS (shared by mouse, keyboard)
// =====================================================================
function build(owner, type, x, y) {
  const p = state.players[owner], T = TYPES[type];
  if (!canBuild(x, y, owner)) return false;
  if (p.credits < T.cost) { floater(x, y - 10, "NEED " + T.cost, "#ff5a5a"); Sound.play("deny", x); return false; }
  p.credits -= T.cost;
  state.towers.push({ type, owner, level: 1, x, y, cool: 0, flash: 0, angle: owner === 0 ? 0 : Math.PI, spent: T.cost, xp: 0 });
  burst(x, y, PCOL[owner], 12);
  Sound.play("build", x);
  return true;
}

function upgrade(t) {
  const p = state.players[t.owner], c = upgradeCost(t);
  if (p.credits < c) { floater(t.x, t.y - 22, "NEED " + c, "#ff5a5a"); Sound.play("deny", t.x); return false; }
  p.credits -= c; t.spent += c; t.level++;
  burst(t.x, t.y, PCOL[t.owner], 14);
  floater(t.x, t.y - 22, "LEVEL " + t.level, PCOL[t.owner]);
  Sound.play("upgrade", t.x);
  return true;
}

function merge(a, b) {
  const p = state.players[a.owner];
  if (p.credits < MERGE_COST) { floater(a.x, a.y - 26, "NEED " + MERGE_COST, "#ff5a5a"); Sound.play("deny", a.x); return false; }
  p.credits -= MERGE_COST;
  const type = hybridFor(a.type, b.type);
  // Beam effect from the absorbed turret into the survivor
  state.beams.push({ x1: b.x, y1: b.y, x2: a.x, y2: a.y, c: GOLD, w: 6, life: 0.35 });
  burst(b.x, b.y, GOLD, 20);
  a.type = type; a.level = 1; a.xp = 0; a.cool = 0;
  a.spent += b.spent + MERGE_COST;
  state.towers = state.towers.filter(o => o !== b);
  burst(a.x, a.y, GOLD, 40);
  state.pulses.push({ x: a.x, y: a.y, r0: 10, r1: 90, life: 0.6, max: 0.6, c: GOLD });
  floater(a.x, a.y - 28, TYPES[type].name + " ONLINE", GOLD);
  Sound.play("merge", a.x);
  p.mergeSel = null;
  return true;
}

function sell(t) {
  const refund = Math.floor(t.spent * 0.6);
  state.players[t.owner].credits += refund;
  state.towers = state.towers.filter(o => o !== t);
  state.players.forEach(p => { if (p.mergeSel === t) p.mergeSel = null; });
  burst(t.x, t.y, "#aab4d8", 14);
  floater(t.x, t.y - 14, "+" + refund + " SOLD", PCOL[t.owner]);
  Sound.play("sell", t.x);
}

function give(from) {
  const p = state.players[from], to = 1 - from;
  if (p.credits < GIVE_AMOUNT) { floater(CORES[from].x, CORES[from].y - 52, "NOT ENOUGH", "#ff5a5a"); Sound.play("deny", CORES[from].x); return; }
  p.credits -= GIVE_AMOUNT;
  state.players[to].credits += GIVE_AMOUNT;
  state.gives++;
  floater(CORES[to].x, CORES[to].y - 52, "+" + GIVE_AMOUNT + " FROM ALLY", PCOL[from]);
  Sound.play("give", CORES[to].x);
}
