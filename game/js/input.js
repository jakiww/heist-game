// The Velvet Vault — input: keyboard movement + mouse coin toss.
// Tracks held keys and the latest mouse click in canvas coordinates.

const keys = {};
let mouseClick = null; // {x, y} in canvas pixels, consumed by main.js
let mousePos = { x: 0, y: 0 };
let spaceThrow = false; // Space throws a coin at the mouse position

function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    // Ignore repeats and browser shortcuts; game keys only.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') spaceThrow = true;
    ensureAudio();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });
  canvas.addEventListener('mousedown', (e) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    mouseClick = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });

  // Keep focus on the page so arrow keys never scroll it.
  canvas.setAttribute('tabindex', '0');
}

// Movement vector from WASD / arrow keys, normalised.
function moveVector() {
  let x = 0, y = 0;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (x !== 0 && y !== 0) {
    const len = Math.hypot(x, y);
    x /= len; y /= len;
  }
  return { x, y };
}

function pressed(key) {
  return !!keys[key];
}

// Take and clear the pending mouse click, if any.
function takeClick() {
  const c = mouseClick;
  mouseClick = null;
  return c;
}

// Take a pending Space-key coin throw: the coin flies at the last
// known mouse position, so keyboard-only players can still distract.
function consumeSpaceThrow() {
  if (!spaceThrow) return null;
  spaceThrow = false;
  return { x: mousePos.x, y: mousePos.y };
}
