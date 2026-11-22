// The Velvet Vault — guards: patrol, vision cones, suspicion,
// and coin distraction. A guard sees the thief only inside its
// cone, within range, and with a clear line of sight.

const GUARD_FOV = 1.22; // ~70 degrees, total
const GUARD_RANGE = 235;
const GUARD_RADIUS = 15;

function makeGuard(route) {
  const start = route.waypoints[0];
  return {
    name: route.name,
    x: start.x,
    y: start.y,
    angle: 0,
    speed: route.speed,
    waypoints: route.waypoints,
    wpIndex: 1,
    waitTimer: 0,
    state: 'patrol', // patrol | investigate | chase
    investigateX: 0,
    investigateY: 0,
    investigateTimer: 0,
    // Where the guard was looking when it last saw the thief; used
    // to keep the cone aimed while the alarm is high.
    lastSeenX: 0,
    lastSeenY: 0,
  };
}

// Move the guard one step (dt seconds). Returns nothing; the guard
// mutates in place. `thief` is {x, y} and `alarm` the 0..100 meter.
function updateGuard(g, dt, thief, alarm) {
  if (g.state === 'investigate') {
    g.investigateTimer -= dt;
    const arrived = moveToward(g, g.investigateX, g.investigateY, dt);
    if (arrived || g.investigateTimer <= 0) {
      // Look around for a moment, then walk back to patrol.
      g.waitTimer += dt;
      if (g.waitTimer > 1.6) {
        g.state = 'patrol';
        g.waitTimer = 0;
      }
    }
    return;
  }

  if (g.state === 'chase') {
    // A guard that has the thief in sight hurries toward them.
    moveToward(g, thief.x, thief.y, dt, 1.35);
    if (alarm < 55) g.state = 'patrol';
    return;
  }

  // Patrol: walk the waypoint loop, pausing at each stop.
  if (g.waitTimer > 0) {
    g.waitTimer -= dt;
    return;
  }
  const target = g.waypoints[g.wpIndex];
  const arrived = moveToward(g, target.x, target.y, dt, 1);
  if (arrived) {
    g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
    g.waitTimer = 0.9;
  }
}

// Step toward (tx, ty); returns true when arrived. `mult` scales speed.
function moveToward(g, tx, ty, dt, mult) {
  const dx = tx - g.x, dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) return true;
  const step = Math.min(dist, g.speed * (mult || 1) * dt);
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  g.angle = Math.atan2(dy, dx);
  return step >= dist - 0.01;
}

// Can this guard see the thief right now?
function guardSees(g, thief) {
  const dx = thief.x - g.x, dy = thief.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD_RANGE) return false;
  const toThief = Math.atan2(dy, dx);
  let diff = toThief - g.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD_FOV / 2) return false;
  if (segmentBlocked(g.x, g.y, thief.x, thief.y)) return false;
  return true;
}

// A thrown coin lands: the nearest guard in earshot walks over.
function distractGuards(guards, coinX, coinY) {
  let best = null, bestDist = 280;
  for (const g of guards) {
    const d = Math.hypot(g.x - coinX, g.y - coinY);
    if (d < bestDist) { best = g; bestDist = d; }
  }
  if (best) {
    best.state = 'investigate';
    best.investigateX = coinX;
    best.investigateY = coinY;
    best.investigateTimer = 6;
    best.waitTimer = 0;
  }
  return best;
}

// Draw a guard: dark uniform, cap, and a translucent vision cone.
function drawGuard(ctx, g, alarm) {
  // Vision cone.
  const coneColor = g.state === 'chase' ? 'rgba(255, 64, 64, 0.30)' : 'rgba(255, 214, 90, 0.22)';
  ctx.fillStyle = coneColor;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.arc(g.x, g.y, GUARD_RANGE, g.angle - GUARD_FOV / 2, g.angle + GUARD_FOV / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = g.state === 'chase' ? 'rgba(255, 64, 64, 0.55)' : 'rgba(255, 214, 90, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Body: navy uniform with a gold badge dot.
  ctx.fillStyle = '#1d2f57';
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e1830';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Facing tick: a short nose line showing look direction.
  ctx.strokeStyle = '#dfe8ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20);
  ctx.stroke();

  // Name tag above the guard.
  ctx.fillStyle = '#cfd8ef';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(g.name, g.x, g.y - GUARD_RADIUS - 7);

  // "!" when chasing, "?" when investigating.
  if (g.state === 'chase' || g.state === 'investigate') {
    ctx.fillStyle = g.state === 'chase' ? '#ff5252' : '#ffd34d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - GUARD_RADIUS - 20);
  }

  // While investigating, a dotted line marks where the guard is headed.
  if (g.state === 'investigate') {
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.investigateX, g.investigateY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
