// The sound service (docs/FINISH_SPEC.md U): the 16-sample pack in
// public/sounds/<name>.m4a replaces the old synthesized tones. The files are
// fetched once (idle, after load) and decoded into ONE AudioContext that is
// created + resumed on the player's first pointer / key (autoplay rules);
// until it is unlocked and a sample is decoded, that sample simply doesn't
// play — nothing here ever throws. Master volume ≈0.6; `tap` varies its pitch
// ±3% per press. The Sound Effects toggle keeps its key and meaning
// ('wordocious-sound-enabled', default on); off mutes everything. Reduce
// Motion does not mute. The event map (sound + haptic per app event) lives in
// lib/sound-map.ts; lib/sound-events.ts `feedback(event)` plays both.

import { haptic } from '@/lib/haptics';
import { MASTER_GAIN, PARTIAL_GAIN, SOUND_DEDUPE_MS, SOUND_NAMES, soundUrl, tapRate, type SoundName } from '@/lib/sound-map';

export { SOUND_NAMES, type SoundName } from '@/lib/sound-map';

const STORAGE_KEY = 'wordocious-sound-enabled';
export const SOUND_PREF_EVENT = 'wordocious:sound-pref';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { return true; }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent(SOUND_PREF_EVENT, { detail: enabled })); } catch { /* old browsers */ }
  if (enabled) prefetchAll();
}

// ── The engine ─────────────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
const raw = new Map<SoundName, Promise<ArrayBuffer | null>>();
const buffers = new Map<SoundName, AudioBuffer>();
const decoding = new Set<SoundName>();
const lastPlayed = new Map<SoundName, number>();
let listening = false;

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
      _master = _ctx.createGain();
      _master.gain.value = MASTER_GAIN;
      _master.connect(_ctx.destination);
      // iOS suspends / interrupts the context in the background: listen for the next tap again.
      _ctx.onstatechange = () => { if (_ctx && _ctx.state !== 'running') listen(); };
    } catch {
      _ctx = null;
      _master = null;
      return null;
    }
  }
  return _ctx;
}

/** Fetch every sample's bytes once (no AudioContext needed yet). */
function prefetchAll(): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  for (const name of SOUND_NAMES) {
    if (raw.has(name)) continue;
    raw.set(
      name,
      fetch(soundUrl(name))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null),
    );
  }
}

function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  // Callback form too: older Safari has no promise-returning decodeAudioData.
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(bytes.slice(0), resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

/** Decode every fetched sample into the context (once each). */
function decodeAll(ctx: AudioContext): void {
  prefetchAll();
  for (const name of SOUND_NAMES) {
    if (buffers.has(name) || decoding.has(name)) continue;
    const bytes = raw.get(name);
    if (!bytes) continue;
    decoding.add(name);
    bytes
      .then((b) => {
        if (!b) { raw.delete(name); return null; } // fetch failed: a later unlock retries
        return decode(ctx, b);
      })
      .then((buf) => { if (buf) buffers.set(name, buf); })
      .catch(() => { raw.delete(name); }) // a later unlock retries the fetch
      .finally(() => decoding.delete(name));
  }
}

function unlock(): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') {
      const r = ctx.resume();
      if (r && typeof r.then === 'function') r.then(() => { if (ctx.state === 'running') unlisten(); }).catch(() => {});
      // iOS: a silent one-sample buffer inside the gesture fully unlocks output.
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } else {
      unlisten();
    }
  } catch { /* try again on the next gesture */ }
  // FINISH_SPEC BJ3: the decodes wait for an idle moment — measured, the first
  // touch of a Home scroll (which unlocks audio) blocked the main thread for
  // 190 ms+ at 4x CPU while every sample decoded inside the gesture.
  whenIdle(() => decodeAll(ctx));
}

function whenIdle(cb: () => void): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') ric(cb, { timeout: 2000 });
  else setTimeout(cb, 300);
}

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

function unlisten(): void {
  if (!listening || typeof window === 'undefined') return;
  listening = false;
  for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock, { capture: true });
}

// Arm once in the browser: listen for the first gesture, prefetch the bytes when idle.
if (typeof window !== 'undefined') {
  listen();
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') ric(() => { if (isSoundEnabled()) prefetchAll(); }, { timeout: 4000 });
  else setTimeout(() => { if (isSoundEnabled()) prefetchAll(); }, 1500);
}

/** Whether `name` started playing within the last `ms`. */
export function recentlyPlayed(name: SoundName, ms: number): boolean {
  const at = lastPlayed.get(name);
  return at != null && now() - at < ms;
}

/** Play one of the 16 samples. Silent when Sound is off, before the first tap, or before the sample decodes. */
export function playSound(name: SoundName, opts: { rate?: number; gain?: number } = {}): void {
  try {
    if (!isSoundEnabled()) return;
    const ctx = _ctx;
    const master = _master;
    if (!ctx || !master || ctx.state !== 'running') return;
    const buf = buffers.get(name);
    if (!buf) { decodeAll(ctx); return; }
    if (recentlyPlayed(name, SOUND_DEDUPE_MS)) return;
    lastPlayed.set(name, now());
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (opts.rate && opts.rate !== 1) src.playbackRate.value = opts.rate;
    if (opts.gain != null && opts.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = Math.max(0, opts.gain);
      src.connect(g);
      g.connect(master);
    } else {
      src.connect(master);
    }
    src.start(0);
  } catch { /* never throw from a sound */ }
}

// ── The named helpers (kept for every existing caller) ─────────────────────

/** Key press: `tap`, pitch ±3%. */
export function playKeyTap() {
  playSound('tap', { rate: tapRate(Math.random()) });
}

/** Delete / backspace. */
export function playDelete() {
  playSound('delete');
}

/** Not a word / wrong move. */
export function playInvalid() {
  playSound('invalid');
}

/**
 * A partial success inside a game (a found word, a solved group, a Muddle
 * step): `notify` at 0.7 + a light haptic — NEVER `win` (Android parity). The
 * win popup plays `win` itself; when this fires right after it (the win
 * wrapper's legacy call) it stays quiet.
 */
export function playSuccess() {
  if (recentlyPlayed('win', 400) || recentlyPlayed('celebrate', 400) || recentlyPlayed('unlock', 400)) return;
  playSound('notify', { gain: PARTIAL_GAIN });
  haptic('light');
}

/** Alias with the clearer name for partial successes. */
export const playPartialSuccess = playSuccess;

/** The VS stinger for the match-intro splash (once per match start). */
export function playVsStinger() {
  if (recentlyPlayed('vs', 1500)) return;
  playSound('vs');
}

/** Soft thunk whenever the opponent lands a guess row. */
export function playOpponentThunk() {
  playSound('flip', { gain: 0.5 });
}

/** Out of guesses (the loss popup plays `lose` itself; the duplicate is dropped). */
export function playGameOver() {
  playSound('lose');
}
