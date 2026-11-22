// The Velvet Vault — wall cameras: fixed mounts that sweep their
// vision cone back and forth. A camera sees the thief only inside
// its cone, within range, and with a clear line of sight.

function makeCamera(spec) {
  return {
    name: spec.name,
    x: spec.x,
    y: spec.y,
    baseAngle: spec.baseAngle,
    sweep: spec.sweep,
    speed: spec.speed,
    range: spec.range,
    fov: spec.fov,
    time: 0,
    angle: spec.baseAngle,
    alert: false, // lit red while the thief is inside this cone
  };
}

// Advance the sweep; `t` is the absolute game clock in seconds.
function updateCamera(cam, t) {
  cam.time = t;
  cam.angle = cam.baseAngle + Math.sin(t * cam.speed) * cam.sweep;
}

function cameraSees(cam, thief) {
  const dx = thief.x - cam.x, dy = thief.y - cam.y;
  const dist = Math.hypot(dx, dy);
  if (dist > cam.range) return false;
  const toThief = Math.atan2(dy, dx);
  let diff = toThief - cam.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > cam.fov / 2) return false;
  if (segmentBlocked(cam.x, cam.y, thief.x, thief.y)) return false;
  return true;
}

// Draw the wall mount, the sweeping cone, and the camera label.
function drawCamera(ctx, cam) {
  // Vision cone: red when the thief is inside, pale red otherwise.
  ctx.fillStyle = cam.alert ? 'rgba(255, 70, 70, 0.32)' : 'rgba(255, 90, 90, 0.15)';
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.arc(cam.x, cam.y, cam.range, cam.angle - cam.fov / 2, cam.angle + cam.fov / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = cam.alert ? 'rgba(255, 70, 70, 0.6)' : 'rgba(255, 90, 90, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Faint arc showing the full sweep range, so players can read
  // where the camera will look next.
  ctx.strokeStyle = 'rgba(255, 120, 110, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, cam.range, cam.baseAngle - cam.sweep - cam.fov / 2, cam.baseAngle + cam.sweep + cam.fov / 2);
  ctx.stroke();

  // Mount: small dark box on the wall plus a lens dot.
  ctx.fillStyle = '#22242c';
  ctx.fillRect(cam.x - 11, cam.y - 8, 22, 16);
  ctx.strokeStyle = '#454a58';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cam.x - 11, cam.y - 8, 22, 16);
  ctx.fillStyle = cam.alert ? '#ff4040' : '#ff8a7a';
  ctx.beginPath();
  ctx.arc(cam.x + Math.cos(cam.angle) * 13, cam.y + Math.sin(cam.angle) * 13, 4, 0, Math.PI * 2);
  ctx.fill();

  // Blinking status light.
  const blink = Math.floor(cam.time * 2) % 2 === 0;
  ctx.fillStyle = cam.alert ? '#ff2020' : (blink ? '#ff5040' : '#7a2020');
  ctx.beginPath();
  ctx.arc(cam.x - 14, cam.y - 10, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Label next to the mount.
  ctx.fillStyle = '#ffb3a7';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  const labelX = cam.x > 1200 ? cam.x - 52 : cam.x + 16;
  const labelY = cam.y > 380 ? cam.y + 26 : cam.y - 14;
  ctx.fillText(cam.name, labelX, labelY);
}
