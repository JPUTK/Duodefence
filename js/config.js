// config.js
// Game constants: map layout, lanes, turret and drone stats, wave tuning.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

const W = 960, FH = 600, H = 690, MID = 480, RIFT = 24;   // FH = battlefield height; HUD below it
const FONT = "Orbitron, sans-serif";

const PCOL = ["#38e1ff", "#ff4fd8"];    // Player 1 cyan, Player 2 magenta
const PRGB = ["56,225,255", "255,79,216"];
const HOSTILE = "#ff9f2e";
const GOLD = "#ffd34d";

// ----- Difficulty levels -----
//   hp:      multiplier on drone health
//   growth:  how much tougher drones get each wave (1.2 = +20% per wave)
//   credits: starting credits for each player
//   core:    core health
//   reward:  multiplier on credits earned per kill
//   waveGap: seconds between waves
const DIFFICULTIES = {
  easy:      { label: "EASY",      color: "#5dff9d", hp: 0.7,  growth: 1.155, credits: 200, core: 40, reward: 1.15, waveGap: 30,
               desc: "Weaker drones, sturdier cores, more time to build" },
  normal:    { label: "NORMAL",    color: "#38e1ff", hp: 1,    growth: 1.2,  credits: 150, core: 30, reward: 1,    waveGap: 25,
               desc: "The intended challenge" },
  hard:      { label: "HARD",      color: "#ffb03b", hp: 1.3,  growth: 1.23, credits: 130, core: 20, reward: 0.9,  waveGap: 22,
               desc: "Tougher drones, fragile cores, less time" },
  nightmare: { label: "NIGHTMARE", color: "#ff4d6d", hp: 1.25, growth: 1.27, credits: 120, core: 12, reward: 0.85, waveGap: 18,
               desc: "Only for perfectly coordinated teams" }
};
const DIFF_ORDER = ["easy", "normal", "hard", "nightmare"];

// ----- Turret types -----
const TYPES = {
  laser: {
    name: "LASER", cost: 50,
    desc: "Rapid beam. Great vs swarms, weak vs armor.",
    lv: [{ range: 115, dmg: 8, rate: 2.5 }, { range: 130, dmg: 14, rate: 3 }, { range: 145, dmg: 22, rate: 3.5 }]
  },
  plasma: {
    name: "PLASMA", cost: 80,
    desc: "Slow splash bolts. Shreds groups and armor.",
    lv: [{ range: 105, dmg: 24, rate: 0.7, splash: 45 }, { range: 115, dmg: 40, rate: 0.8, splash: 55 }, { range: 125, dmg: 62, rate: 0.9, splash: 65 }]
  },
  cryo: {
    name: "CRYO", cost: 70,
    desc: "Freeze pulse. Slows all nearby, ignores armor.",
    lv: [{ range: 85, dmg: 3, rate: 0.8, slow: 0.6 }, { range: 95, dmg: 6, rate: 0.9, slow: 0.5 }, { range: 105, dmg: 10, rate: 1, slow: 0.4 }]
  },
  // ----- Hybrids (made by merging two elite turrets) -----
  ion: {
    name: "ION LANCE", parts: ["laser", "plasma"],
    desc: "Piercing beam hits every drone in a line, ignores armor.",
    lv: [{ range: 165, dmg: 44, rate: 1.5 }]
  },
  frost: {
    name: "FROST LANCE", parts: ["laser", "cryo"],
    desc: "Rapid freezing beam. Targets take +40% damage from all turrets.",
    lv: [{ range: 150, dmg: 18, rate: 4, slow: 0.5 }]
  },
  nova: {
    name: "NOVA MORTAR", parts: ["plasma", "cryo"],
    desc: "Frost bombs: huge splash, deep slow, leaves a freezing field.",
    lv: [{ range: 140, dmg: 70, rate: 0.75, splash: 75, slow: 0.35, fieldDps: 20 }]
  }
};
const ORDER = ["laser", "plasma", "cryo"];
const GIVE_AMOUNT = 25;
const XP_ELITE = 1200;
const MERGE_COST = 200;
const MERGE_RANGE = 130;
const upgradeCost = t => Math.round(TYPES[t.type].cost * (t.level === 1 ? 0.8 : 1.4));
const isHybrid = t => !!TYPES[t.type].parts;
const isElite = t => !isHybrid(t) && t.level === 3 && t.xp >= XP_ELITE;
const hybridFor = (a, b) => a === b ? null :
  Object.keys(TYPES).find(k => TYPES[k].parts && TYPES[k].parts.includes(a) && TYPES[k].parts.includes(b));
const canMerge = (a, b) => a !== b && a.owner === b.owner && isElite(a) && isElite(b) &&
  a.type !== b.type && Math.hypot(a.x - b.x, a.y - b.y) <= MERGE_RANGE;

// ----- Enemy types (weights relative to the wave's base stats) -----
const KINDS = {
  grunt:      { hp: 1,   spd: 1,    armor: 0, core: 1, r: 10 },
  scout:      { hp: 0.55, spd: 1.6, armor: 0, core: 1, r: 8 },
  tank:       { hp: 2.4, spd: 0.75, armor: 3, core: 2, r: 13 },
  carrier:    { hp: 10,  spd: 0.7,  armor: 0, core: 4, r: 18, rew: 10 },
  juggernaut: { hp: 14,  spd: 0.6,  armor: 7, core: 5, r: 20, rew: 10 }
};

// Each lane has its own character. Lane B is shorter, so its drones move slower
// to take about the same time to cross. Both lanes get the same total HP per wave.
const PROFILES = [
  { count: 1.35, spd: 1.0, boss: "carrier",    mix: (w, i) => (w >= 2 && i % 3 === 1) ? "scout" : "grunt" },
  { count: 0.7,  spd: 0.64, boss: "juggernaut", mix: (w, i) => (w >= 2 && i % 2 === 1) ? "tank" : "grunt" }
];

const surgeLane = w => w % 4 === 0 ? ((w / 4) % 2 === 1 ? 0 : 1) : -1;

// ----- HUD panels (below the battlefield) -----
const PANELS = [{ x: 8, y: FH + 6, w: 464, h: 78 }, { x: 488, y: FH + 6, w: 464, h: 78 }];
const KEYS = [["1", "2", "3"], ["8", "9", "0"]];

function panelButtons(i) {
  const P = PANELS[i];
  const b = ORDER.map((type, k) => ({ type, x: P.x + 160 + k * 76, y: P.y + 10, w: 70, h: 58 }));
  b.push({ type: "give", x: P.x + 160 + 3 * 76, y: P.y + 10, w: 70, h: 58 });
  return b;
}
