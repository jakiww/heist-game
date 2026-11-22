// The Velvet Vault — main game: state, loop, rendering, HUD.
// A top-down museum heist in one room: cross the hall, dodge guard
// vision cones and sweeping cameras, grab three loot pieces, and
// slip out the velvet door before the alarm meter hits 100%.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = LEVEL.width;
const H = LEVEL.height;
const THIEF_SPEED = 175;
const THIEF_RADIUS = 14;
const ALARM_RISE = 46; // per second while seen
const ALARM_FALL = 13; // per second while hidden
const COIN_START = 5;

// Scene presets for screenshots (?scene=cover|sneak|alert|exit).
// Each one places the thief, guards and alarm deterministically so
// a screenshot is a real render of the same code players run.
const SCENES = {
  cover: { thief: { x: 150, y: 660 }, alarm: 12, lootTaken: 0 },
  sneak: { thief: { x: 470, y: 394 }, alarm: 26, lootTaken: 0 },
  alert: { thief: { x: 640, y: 430 }, alarm: 78, lootTaken: 1 },
  exit: { thief: { x: 1120, y: 110 }, alarm: 8, lootTaken: 3 },
};

function sceneName() {
  const q = new URLSearchParams(window.location.search).get('scene');
  return SCENES[q] ? q : 'cover';
}

const game = {
  state: 'play', // play | caught | win
  time: 0,
  alarm: 0,
  score: 0,
  coins: COIN_START,
  lootGot: 0,
  thief: { x: LEVEL.spawn.x, y: LEVEL.spawn.y, angle: -Math.PI / 2 },
  guards: LEVEL.guardRoutes.map(makeGuard),
  cameras: LEVEL.cameras.map(makeCamera),
  coin: null, // flying coin: {x, y, tx, ty, t}
  landedCoin: null, // {x, y, timer}
  message: '',
  messageTimer: 0,
  alarmBeepTimer: 0,
  stepTimer: 0,
  seenNow: false,
  seenBy: '',
};

function applyScene() {
  const s = SCENES[sceneName()];
  game.thief.x = s.thief.x;
  game.thief.y = s.thief.y;
  game.alarm = s.alarm;
  for (let i = 0; i < s.lootTaken; i++) {
    LEVEL.loot[i].taken = true;
    game.lootGot++;
    game.score += LEVEL.loot[i].value;
  }
  // Deterministic guard placement per scene: run the patrol a fixed
  // number of steps so the cones sit in interesting spots.
  const steps = sceneName() === 'alert' ? 260 : sceneName() === 'sneak' ? 150 : 90;
  for (let i = 0; i < steps; i++) {
    for (const g of game.guards) updateGuard(g, 1 / 60, game.thief, 0);
  }
  if (sceneName() === 'alert') {
    // Aim the nearest guard's cone at the thief for the shot.
    const g = game.guards[0];
    g.x = 640; g.y = 300;
    g.angle = Math.PI / 2;
    g.state = 'chase';
  }
}

function resetGame() {
  game.state = 'play';
  game.time = 0;
  game.alarm = 0;
  game.score = 0;
  game.coins = COIN_START;
  game.lootGot = 0;
  game.thief.x = LEVEL.spawn.x;
  game.thief.y = LEVEL.spawn.y;
  game.thief.angle = -Math.PI / 2;
  game.guards = LEVEL.guardRoutes.map(makeGuard);
  game.cameras = LEVEL.cameras.map(makeCamera);
  game.coin = null;
  game.landedCoin = null;
  game.message = '';
  game.messageTimer = 0;
  for (const l of LEVEL.loot) l.taken = false;
  applyScene();
}

function nearestLoot() {
  let best = null, bestD = 52;
  for (const l of LEVEL.loot) {
    if (l.taken) continue;
    const d = Math.hypot(l.x - game.thief.x, l.y - game.thief.y);
    if (d < bestD) { best = l; bestD = d; }
  }
  return best;
}

function showMessage(text, seconds) {
  game.message = text;
  game.messageTimer = seconds || 2.2;
}

function update(dt) {
  game.time += dt;

  // --- input: move the thief, blocked by walls and cover ---
  const mv = moveVector();
  if (mv.x !== 0 || mv.y !== 0) {
    game.thief.angle = Math.atan2(mv.y, mv.x);
    const nx = game.thief.x + mv.x * THIEF_SPEED * dt;
    const ny = game.thief.y + mv.y * THIEF_SPEED * dt;
    if (!hitsBlocker(nx, game.thief.y, THIEF_RADIUS)) game.thief.x = nx;
    if (!hitsBlocker(game.thief.x, ny, THIEF_RADIUS)) game.thief.y = ny;
    game.stepTimer -= dt;
    if (game.stepTimer <= 0) { playStep(); game.stepTimer = 0.34; }
  }

  // --- mouse / space: throw a coin toward the click point ---
  const click = takeClick() || consumeSpaceThrow();
  if (click && !game.coin && game.coins > 0) {
    game.coins--;
    game.coin = { x: game.thief.x, y: game.thief.y, tx: click.x, ty: click.y, t: 0 };
    playClick();
  } else if (click && game.coins <= 0) {
    showMessage('Out of coins!', 1.4);
  }

  // --- flying coin ---
  if (game.coin) {
    game.coin.t += dt * 2.2;
    const c = game.coin;
    c.x += (c.tx - c.x) * dt * 6;
    c.y += (c.ty - c.y) * dt * 6;
    if (c.t >= 1) {
      game.landedCoin = { x: c.tx, y: c.ty, timer: 5 };
      const g = distractGuards(game.guards, c.tx, c.ty);
      if (g) showMessage(g.name + ' heard the coin!', 2);
      playCoin();
      game.coin = null;
    }
  }
  if (game.landedCoin) {
    game.landedCoin.timer -= dt;
    if (game.landedCoin.timer <= 0) game.landedCoin = null;
  }

  // --- E: grab loot ---
  if (pressed('e')) {
    const l = nearestLoot();
    if (l) {
      l.taken = true;
      game.lootGot++;
      game.score += l.value;
      playPickup();
      if (game.lootGot >= LEVEL.loot.length) {
        playUnlock();
        showMessage('All loot! Get to the velvet door!', 2.5);
      } else {
        showMessage(l.name + ' taken! +' + l.value, 2);
      }
    }
    keys['e'] = false; // single grab per press
  }

  // --- guards and cameras ---
  let seen = false;
  let seenBy = '';
  for (const g of game.guards) {
    updateGuard(g, dt, game.thief, game.alarm);
    if (guardSees(g, game.thief)) {
      seen = true;
      seenBy = 'Guard ' + g.name;
      g.state = 'chase';
      g.lastSeenX = game.thief.x;
      g.lastSeenY = game.thief.y;
    }
  }
  for (const cam of game.cameras) {
    updateCamera(cam, game.time);
    cam.alert = cameraSees(cam, game.thief);
    if (cam.alert) { seen = true; seenBy = cam.name; }
  }
  game.seenNow = seen;
  game.seenBy = seenBy;

  // --- alarm meter ---
  if (seen) {
    game.alarm += ALARM_RISE * dt;
    game.alarmBeepTimer -= dt;
    if (game.alarmBeepTimer <= 0) { playAlarm(); game.alarmBeepTimer = 1.1; }
  } else {
    game.alarm -= ALARM_FALL * dt;
  }
  game.alarm = Math.max(0, Math.min(100, game.alarm));

  if (game.alarm >= 100) {
    game.state = 'caught';
    playCaught();
    return;
  }

  // --- exit: only opens with all three loot pieces ---
  const ex = LEVEL.exit;
  const inExit = game.thief.x > ex.x - 10 && game.thief.x < ex.x + ex.w + 10 &&
    game.thief.y > ex.y - 10 && game.thief.y < ex.y + ex.h + 10;
  if (inExit) {
    if (game.lootGot >= LEVEL.loot.length) {
      game.state = 'win';
      game.score += Math.max(0, 600 - Math.floor(game.time) * 2);
      playWin();
    } else {
      showMessage('Locked — take all 3 loot first (' + game.lootGot + '/3)', 1.2);
    }
  }

  if (game.messageTimer > 0) game.messageTimer -= dt;
}

// ---------------- rendering ----------------

function drawFloor() {
  ctx.fillStyle = '#2a2f3f';
  ctx.fillRect(0, 0, W, H);
  // Marble tiles.
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Faint floor lettering.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.textAlign = 'center';
  for (const m of LEVEL.floorMarks) {
    ctx.font = 'bold ' + m.size + 'px sans-serif';
    ctx.fillText(m.text, m.x, m.y);
  }
  // Entrance mat and exit carpet.
  ctx.fillStyle = 'rgba(120, 90, 40, 0.35)';
  ctx.fillRect(40, 690, 130, 86);
  ctx.fillStyle = 'rgba(160, 30, 50, 0.4)';
  ctx.fillRect(LEVEL.exit.x - 6, LEVEL.exit.y - 6, LEVEL.exit.w + 12, LEVEL.exit.h + 60);
  // Wall torches: a warm glow dot and a small flame.
  for (const t of LEVEL.torches) {
    const flicker = 0.55 + 0.2 * Math.sin(game.time * 5 + t.x);
    ctx.globalAlpha = flicker * 0.35;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWallsAndCover() {
  for (const w of LEVEL.walls) {
    ctx.fillStyle = '#4a4238';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#6b5f4c';
    ctx.fillRect(w.x, w.y, w.w, 4);
  }
  for (const c of LEVEL.cover) {
    if (c.kind === 'pillar') {
      ctx.fillStyle = '#8a7a5c';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b09b6d';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 15, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.kind === 'case') {
      ctx.fillStyle = '#3d5a73';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#9fd0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      ctx.fillStyle = '#cfe6ff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.label, c.x + c.w / 2, c.y + c.h / 2 + 4);
    } else {
      ctx.fillStyle = '#6d5233';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#8a6b42';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h);
      ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h);
      ctx.stroke();
    }
  }
}

function drawLoot() {
  for (const l of LEVEL.loot) {
    if (l.taken) continue;
    // Glow ring so the target reads from across the room.
    const pulse = 0.5 + 0.3 * Math.sin(game.time * 3 + l.x);
    ctx.strokeStyle = l.color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (l.id === 'diamond') {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y - 14);
      ctx.lineTo(l.x + 13, l.y - 2);
      ctx.lineTo(l.x, l.y + 14);
      ctx.lineTo(l.x - 13, l.y - 2);
      ctx.closePath();
      ctx.fill();
    } else if (l.id === 'gold') {
      ctx.fillStyle = l.color;
      ctx.fillRect(l.x - 13, l.y - 8, 26, 16);
      ctx.fillStyle = '#b98a1d';
      ctx.fillRect(l.x - 13, l.y + 2, 26, 4);
    } else {
      ctx.fillStyle = '#7a4a2d';
      ctx.fillRect(l.x - 13, l.y - 16, 26, 32);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(l.x - 13, l.y - 16, 26, 32);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8ecf7';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.name, l.x, l.y + 42);
  }
}

function drawThief() {
  const t = game.thief;
  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 10, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: black-clad thief with a burgundy mask stripe.
  ctx.fillStyle = '#14141a';
  ctx.beginPath();
  ctx.arc(t.x, t.y, THIEF_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a1f2b';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(t.x + Math.cos(t.angle) * 19, t.y + Math.sin(t.angle) * 19);
  ctx.stroke();
  // Loot sack bulge once something is carried.
  if (game.lootGot > 0) {
    ctx.fillStyle = '#8a6b42';
    ctx.beginPath();
    ctx.arc(t.x - Math.cos(t.angle) * 12, t.y - Math.sin(t.angle) * 12, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8ecf7';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOU', t.x, t.y - THIEF_RADIUS - 7);
}

function drawExit() {
  const ex = LEVEL.exit;
  const open = game.lootGot >= LEVEL.loot.length;
  const glow = open ? (0.5 + 0.3 * Math.sin(game.time * 4)) : 0.3;
  // Gold door frame so the exit reads as a door, locked or open.
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(ex.x - 4, ex.y - 4, ex.w + 8, ex.h + 8);
  ctx.globalAlpha = glow;
  ctx.fillStyle = open ? '#37d67a' : '#6e2430';
  ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
  ctx.globalAlpha = 1;
  // Door split line down the middle.
  ctx.strokeStyle = open ? '#1d7a44' : '#3d1219';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex.x + ex.w / 2, ex.y);
  ctx.lineTo(ex.x + ex.w / 2, ex.y + ex.h);
  ctx.stroke();
  ctx.strokeStyle = open ? '#37d67a' : '#c9a0a6';
  ctx.lineWidth = 2;
  ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT — GO!' : 'EXIT (LOCKED)', ex.x + ex.w / 2, ex.y + ex.h + 16);
  // Door frame.
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(ex.x - 6, ex.y - 8, ex.w + 12, 8);
}

function drawCoin() {
  if (game.coin) {
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(game.coin.x, game.coin.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b98a1d';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (game.landedCoin) {
    const pulse = 0.4 + 0.3 * Math.sin(game.time * 6);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(game.landedCoin.x, game.landedCoin.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(game.landedCoin.x, game.landedCoin.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD() {
  // Top bar.
  ctx.fillStyle = 'rgba(10, 12, 20, 0.82)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#e8ecf7';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THE VELVET VAULT', 16, 29);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9aa5c0';
  const mins = Math.floor(game.time / 60);
  const secs = Math.floor(game.time % 60);
  ctx.fillText('TIME ' + mins + ':' + String(secs).padStart(2, '0'), 250, 29);
  ctx.fillText('SCORE ' + game.score, 370, 29);
  ctx.fillText('LOOT ' + game.lootGot + '/' + LEVEL.loot.length, 490, 29);
  ctx.fillText('COINS ' + game.coins + ' (click to throw)', 590, 29);

  // Alarm meter, top-right: label + bar + percentage.
  const bx = 900, by = 13, bw = 260, bh = 20;
  ctx.fillStyle = '#9aa5c0';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', bx, by + 15);
  ctx.fillStyle = '#20242f';
  ctx.fillRect(bx + 62, by, bw - 62, bh);
  const frac = game.alarm / 100;
  ctx.fillStyle = game.alarm > 66 ? '#ff4040' : game.alarm > 33 ? '#ff9d2e' : '#37d67a';
  ctx.fillRect(bx + 62, by, (bw - 62) * frac, bh);
  ctx.strokeStyle = '#5a6274';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 62, by, bw - 62, bh);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(game.alarm) + '%', bx + 62 + (bw - 62) / 2, by + 15);

  // "SEEN" warning under the bar.
  if (game.seenNow) {
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SPOTTED BY ' + game.seenBy + '!', W - 16, 64);
  }

  // Bottom help line.
  ctx.fillStyle = 'rgba(10, 12, 20, 0.82)';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#9aa5c0';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD / arrows move  •  E grab loot  •  click throws a coin to distract a guard  •  R restart  •  M mute', W / 2, H - 10);

  // Transient centre message.
  if (game.messageTimer > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, W / 2, 84);
  }
}

function drawEndScreen() {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (game.state === 'caught') {
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('CAUGHT!', W / 2, H / 2 - 40);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = '20px sans-serif';
    ctx.fillText('The alarm hit 100%. The guards take you away in cuffs.', W / 2, H / 2 + 6);
  } else {
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('CLEAN GETAWAY!', W / 2, H / 2 - 40);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = '20px sans-serif';
    ctx.fillText('All three treasures, out the velvet door, no alarms left ringing.', W / 2, H / 2 + 6);
  }
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('SCORE ' + game.score + '   •   TIME ' + Math.floor(game.time) + 's', W / 2, H / 2 + 52);
  ctx.fillStyle = '#9aa5c0';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press R to try again', W / 2, H / 2 + 92);
}

function render() {
  drawFloor();
  drawExit();
  drawLoot();
  for (const cam of game.cameras) drawCamera(ctx, cam);
  for (const g of game.guards) drawGuard(ctx, g, game.alarm);
  drawWallsAndCover();
  drawCoin();
  drawThief();
  // Red vignette while the alarm is high.
  if (game.alarm > 50) {
    ctx.strokeStyle = 'rgba(255, 40, 40, ' + ((game.alarm - 50) / 100).toFixed(2) + ')';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
  }
  drawHUD();
  if (game.state !== 'play') drawEndScreen();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'play') update(dt);
  // R restarts from any state; M toggles mute.
  if (pressed('r')) {
    keys['r'] = false;
    resetGame();
  }
  if (pressed('m')) {
    keys['m'] = false;
    setMuted(!isMuted());
    showMessage(isMuted() ? 'Sound off' : 'Sound on', 1.2);
  }
  render();
  requestAnimationFrame(frame);
}

initInput(canvas);
resetGame();
requestAnimationFrame(frame);
