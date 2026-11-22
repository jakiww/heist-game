// The Velvet Vault — sound: tiny WebAudio synth, no audio files.
// Every effect is an oscillator (or a short noise burst) so the
// game stays a set of static files with zero network requests.

let audioCtx = null;
let muted = false;

// Lazily created on the first user gesture, so browsers allow it.
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function setMuted(m) {
  muted = m;
}

function isMuted() {
  return muted;
}

// One short tone: frequency slides from `from` to `to` over `dur`.
function tone(from, to, dur, type, gainValue, delay) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(gainValue || 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playPickup() {
  // Bright two-note chime for grabbing loot.
  tone(660, 660, 0.09, 'triangle', 0.14, 0);
  tone(990, 990, 0.14, 'triangle', 0.14, 0.08);
}

function playCoin() {
  // Metallic clink when a thrown coin lands.
  tone(2400, 1700, 0.07, 'square', 0.06, 0);
  tone(1900, 1400, 0.09, 'square', 0.05, 0.06);
}

function playUnlock() {
  // Low brass-ish unlock chord when the last loot opens the exit.
  tone(196, 196, 0.25, 'triangle', 0.13, 0);
  tone(294, 294, 0.25, 'triangle', 0.13, 0.1);
  tone(392, 392, 0.35, 'triangle', 0.13, 0.2);
}

function playStep() {
  // Soft footstep tick, kept quiet so it never annoys.
  tone(180, 120, 0.05, 'sine', 0.03, 0);
}

function playAlarm() {
  // Two-beat warning siren while the alarm climbs.
  tone(520, 780, 0.16, 'sawtooth', 0.08, 0);
  tone(780, 520, 0.16, 'sawtooth', 0.08, 0.18);
}

function playCaught() {
  // Descending sting for getting caught.
  tone(440, 110, 0.7, 'sawtooth', 0.14, 0);
  tone(220, 55, 0.7, 'triangle', 0.12, 0.05);
}

function playWin() {
  // Rising little fanfare for escaping with the loot.
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i++) {
    tone(notes[i], notes[i], 0.16, 'triangle', 0.13, i * 0.12);
  }
}

function playClick() {
  tone(800, 800, 0.04, 'sine', 0.06, 0);
}
