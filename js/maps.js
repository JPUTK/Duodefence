// maps.js
// Every battlefield layout, and loadMap() to switch between them.
//
// Each map has two lanes:
//   lanes[0] runs through Player 1's side (left) and ends at Player 2's core  (the Swarm Lane)
//   lanes[1] runs through Player 2's side (right) and ends at Player 1's core (the Heavy Lane)
// Points are [x, y] on a 960 x 600 field. Start a lane just off-screen so drones walk in.
// cores[0] is Player 1's core (where lanes[1] ends); cores[1] is Player 2's (where lanes[0] ends).
//
// Fairness: drones are sped up or slowed down so they take the same time to walk
// each lane as on The Rift, which the balance was tuned on. "speed" can nudge that per lane.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

const MAPS = [
  {
    id: "rift", name: "THE RIFT",
    desc: "The original. A long, winding Swarm Lane against a short, brutal Heavy Lane.",
    lanes: [
      [[60,-40],[60,500],[180,500],[180,100],[300,100],[300,540],[600,540]],
      [[900,640],[900,440],[700,440],[700,250],[860,250],[860,80],[410,80]]
    ],
    cores: [{ x: 410, y: 80 }, { x: 600, y: 540 }],
    labels: [{ x: 82, y: 22, align: "left" }, { x: 878, y: 588, align: "right" }],
    portals: [{ x: 60, y: 3 }, { x: 900, y: FH - 3 }]
  },
  {
    id: "switchback", name: "SWITCHBACK",
    desc: "The Swarm Lane zigzags in tight rows. Long routes, narrow strips to build on.",
    lanes: [
      [[400,-40],[400,110],[80,110],[80,230],[400,230],[400,350],[80,350],[80,470],[600,470]],
      [[1000,140],[620,140],[620,280],[880,280],[880,420],[760,420],[760,560],[390,560]]
    ],
    cores: [{ x: 390, y: 560 }, { x: 600, y: 470 }],
    labels: [{ x: 378, y: 22, align: "right" }, { x: 948, y: 116, align: "right" }],
    portals: [{ x: 400, y: 3 }, { x: W - 3, y: 140, vertical: true }]
  },
  {
    id: "lightning", name: "LIGHTNING",
    desc: "Sharp diagonal zigzags. A turret placed in a bend can cover two stretches at once.",
    lanes: [
      [[60,-40],[60,80],[380,200],[80,330],[380,460],[600,520]],
      [[900,640],[900,520],[580,400],[880,270],[580,140],[360,80]]
    ],
    cores: [{ x: 360, y: 80 }, { x: 600, y: 520 }],
    labels: [{ x: 82, y: 22, align: "left" }, { x: 878, y: 588, align: "right" }],
    portals: [{ x: 60, y: 3 }, { x: 900, y: FH - 3 }]
  },
  {
    id: "perimeter", name: "PERIMETER",
    desc: "Lanes hug the outer edges, leaving a huge open interior to fortify.",
    lanes: [
      [[260,-40],[260,60],[40,60],[40,540],[300,540],[300,420],[580,420]],
      [[700,640],[700,540],[920,540],[920,60],[660,60],[660,180],[380,180]]
    ],
    cores: [{ x: 380, y: 180 }, { x: 580, y: 420 }],
    labels: [{ x: 238, y: 22, align: "right" }, { x: 722, y: 588, align: "left" }],
    portals: [{ x: 260, y: 3 }, { x: 700, y: FH - 3 }]
  }
];

const LANE_NAMES = ["SWARM LANE", "HEAVY LANE"];
let MAP, LANES, CORES;
const onMapLoad = []; // other files add functions here to run whenever the map changes

function buildLane(path) {
  const l = { path, segs: [], len: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    l.segs.push({ ax, ay, bx, by, len, start: l.len });
    l.len += len;
  }
  return l;
}

function pointAt(lane, s) {
  for (const g of lane.segs) {
    if (s <= g.start + g.len) {
      const t = (s - g.start) / g.len;
      return { x: g.ax + (g.bx - g.ax) * t, y: g.ay + (g.by - g.ay) * t, a: Math.atan2(g.by - g.ay, g.bx - g.ax) };
    }
  }
  const g = lane.segs[lane.segs.length - 1];
  return { x: g.bx, y: g.by, a: Math.atan2(g.by - g.ay, g.bx - g.ax) };
}

// The Rift's lane lengths are the reference the balance was tuned on
const REF_LEN = MAPS[0].lanes.map(p => buildLane(p).len);

function loadMap(id) {
  MAP = MAPS.find(m => m.id === id) || MAPS[0];
  LANES = MAP.lanes.map((path, i) => {
    const l = buildLane(path);
    const lbl = MAP.labels[i];
    return Object.assign(l, {
      guard: i, target: 1 - i, label: LANE_NAMES[i],
      labelX: lbl.x, labelY: lbl.y, align: lbl.align,
      speedScale: (l.len / REF_LEN[i]) * (MAP.speed ? MAP.speed[i] : 1)
    });
  });
  CORES = MAP.cores;
  try { localStorage.setItem("riftMap", MAP.id); } catch (e) {}
  onMapLoad.forEach(fn => fn());
}

function cycleMap(dir) {
  const i = MAPS.indexOf(MAP);
  loadMap(MAPS[(i + dir + MAPS.length) % MAPS.length].id);
}

let savedMap = "rift";
try { savedMap = localStorage.getItem("riftMap") || "rift"; } catch (e) {}
loadMap(savedMap);
