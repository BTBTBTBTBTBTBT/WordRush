let _ctx: AudioContext | null = null;
const STORAGE_KEY = 'wordocious-sound-enabled';

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

function play(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playKeyTap() {
  play(800, 0.04, 'square', 0.06);
}

export function playInvalid() {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  play(200, 0.15, 'sawtooth', 0.08);
  setTimeout(() => play(150, 0.15, 'sawtooth', 0.06), 80);
}

export function playSuccess() {
  if (!isSoundEnabled()) return;
  play(523, 0.12, 'sine', 0.1);
  setTimeout(() => play(659, 0.12, 'sine', 0.1), 100);
  setTimeout(() => play(784, 0.2, 'sine', 0.12), 200);
}

/** Two-note "VS" stinger for the match-intro splash. */
export function playVsStinger() {
  if (!isSoundEnabled()) return;
  play(392, 0.1, 'sine', 0.1);
  setTimeout(() => play(523, 0.18, 'sine', 0.1), 100);
}

/** Soft thunk played whenever the opponent lands a guess row. */
export function playOpponentThunk() {
  play(220, 0.06, 'sine', 0.05);
}

export function playGameOver() {
  if (!isSoundEnabled()) return;
  play(392, 0.2, 'sine', 0.1);
  setTimeout(() => play(330, 0.2, 'sine', 0.1), 150);
  setTimeout(() => play(262, 0.3, 'sine', 0.08), 300);
}
