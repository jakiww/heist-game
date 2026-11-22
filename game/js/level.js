// The Velvet Vault — level layout (museum vault hall, 1280 x 800).
// All coordinates are in canvas pixels. Walls and crates block both
// movement and line of sight, so they double as cover from guards
// and cameras. Nothing here is loaded from the network.

const LEVEL = {
  width: 1280,
  height: 800,
  wallThickness: 24,

  // The thief starts at the service door, bottom-left.
  spawn: { x: 84, y: 700 },

  // The exit is the velvet-curtained door, top-right. It only opens
  // once every loot piece has been taken.
  exit: { x: 1160, y: 78, w: 84, h: 40 },

  // Three loot targets, each with a score value.
  loot: [
    { id: 'diamond', name: 'Star of Velvet Diamond', x: 640, y: 330, value: 500, color: '#8fd8ff', taken: false },
    { id: 'gold', name: 'Gold Bullion Stack', x: 236, y: 250, value: 300, color: '#ffd34d', taken: false },
    { id: 'painting', name: 'Portrait of the Duchess', x: 1010, y: 210, value: 400, color: '#ff9d6b', taken: false },
  ],

  // Static cover: pillars, display cases and crates. The `label`
  // field is drawn on the floor plan for readability.
  cover: [
    { x: 300, y: 150, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 560, y: 150, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 820, y: 150, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 300, y: 560, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 560, y: 560, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 820, y: 560, w: 46, h: 46, kind: 'pillar', label: '' },
    { x: 430, y: 300, w: 110, h: 60, kind: 'case', label: 'GEMS' },
    { x: 740, y: 430, w: 110, h: 60, kind: 'case', label: 'RELIC' },
    { x: 150, y: 420, w: 90, h: 54, kind: 'crate', label: '' },
    { x: 1010, y: 470, w: 90, h: 54, kind: 'crate', label: '' },
    { x: 620, y: 660, w: 130, h: 44, kind: 'crate', label: '' },
  ],

  // Guard patrol routes: each guard walks its waypoints in order,
  // pauses briefly at each one, then turns around.
  guardRoutes: [
    {
      name: 'Bruno',
      speed: 62,
      waypoints: [
        { x: 420, y: 200 },
        { x: 860, y: 200 },
        { x: 860, y: 420 },
        { x: 420, y: 420 },
      ],
    },
    {
      name: 'Marta',
      speed: 55,
      waypoints: [
        { x: 900, y: 620 },
        { x: 420, y: 620 },
        { x: 420, y: 480 },
        { x: 900, y: 480 },
      ],
    },
  ],

  // Wall-mounted sweeping cameras: fixed position, oscillating angle.
  cameras: [
    { name: 'CAM-1', x: 640, y: 34, baseAngle: Math.PI / 2, sweep: 0.85, speed: 0.55, range: 300, fov: 0.9 },
    { name: 'CAM-2', x: 1246, y: 400, baseAngle: Math.PI, sweep: 0.7, speed: 0.45, range: 290, fov: 0.9 },
  ],

  // Decorative floor text, drawn faintly on the marble.
  floorMarks: [
    { text: 'THE VELVET VAULT', x: 640, y: 96, size: 26 },
    { text: 'GALLERY A', x: 240, y: 660, size: 15 },
    { text: 'GALLERY B', x: 1040, y: 660, size: 15 },
  ],

  // Wall torches: warm light dots along the top and side walls.
  // Pure decoration — they block nothing and see nothing.
  torches: [
    { x: 200, y: 30 }, { x: 440, y: 30 }, { x: 880, y: 30 }, { x: 1100, y: 30 },
    { x: 30, y: 250 }, { x: 30, y: 520 }, { x: 1250, y: 620 },
  ],
};

// Outer walls, derived from the room size so the room stays sealed.
LEVEL.walls = [
  { x: 0, y: 0, w: LEVEL.width, h: LEVEL.wallThickness }, // top
  { x: 0, y: LEVEL.height - LEVEL.wallThickness, w: LEVEL.width, h: LEVEL.wallThickness }, // bottom
  { x: 0, y: 0, w: LEVEL.wallThickness, h: LEVEL.height }, // left
  { x: LEVEL.width - LEVEL.wallThickness, y: 0, w: LEVEL.wallThickness, h: LEVEL.height }, // right
];

// Everything that blocks sight and movement: walls + cover.
LEVEL.blockers = LEVEL.walls.concat(LEVEL.cover);

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// True when a circle at (x, y) with radius r touches any blocker.
function hitsBlocker(x, y, r) {
  const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  for (const b of LEVEL.blockers) {
    if (rectsOverlap(box, b)) return true;
  }
  return false;
}

// Segment (x1,y1)-(x2,y2) blocked by any blocker? Used for
// line-of-sight: a guard or camera only sees the thief when the
// straight line between them is clear.
function segmentBlocked(x1, y1, x2, y2) {
  for (const b of LEVEL.blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Quick reject: segment bounding box does not touch the rect.
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) return false;
  // Either endpoint inside the rect, or the segment crosses an edge.
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const edges = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const e of edges) {
    if (segmentsCross(x1, y1, x2, y2, e[0], e[1], e[2], e[3])) return true;
  }
  return false;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
  const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy);
  const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
  const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}
