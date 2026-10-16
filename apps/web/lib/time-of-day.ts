// Time of day on the web (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2): while a season shows, its wall, Home
// stage and window surfaces follow the device's LOCAL clock (core timeOfDay: morning 5-10, day 10-16, evening 16-19, night 19-5).
// ONE app-wide store: a single timer armed at the next boundary (core nextTimeOfDayChange, never polling) plus a re-read when the
// tab comes back, read by every season piece through useTimeOfDay (useSyncExternalStore). An admin preview ("Time of day" in
// Settings > Season preview, `?tod=morning|day|evening|night|auto`) overrides the clock for the browser session.
import { useSyncExternalStore } from 'react';
import { nextTimeOfDayChange, timeOfDayAt, type TimeOfDay } from '@wordle-duel/core';

export type { TimeOfDay };

export const TOD_PARAM = 'tod';
export const TOD_PREVIEW_KEY = 'wordocious-tod-preview';
/** Fired on window when the admin override changes (the store re-reads). */
export const TOD_EVENT = 'wordocious:tod';

const SLOTS: readonly TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

/** A stored / query value, validated (anything else = no override). */
export function parseTod(v: string | null | undefined): TimeOfDay | null {
  const s = (v ?? '').trim().toLowerCase();
  return (SLOTS as readonly string[]).includes(s) ? (s as TimeOfDay) : null;
}

/** The admin override (client only): a `?tod=` on this page wins and is remembered for the session; `auto` clears it. */
export function readTodOverride(): TimeOfDay | null {
  if (typeof window === 'undefined') return null;
  let q: string | null = null;
  try { q = new URLSearchParams(window.location.search).get(TOD_PARAM); } catch { q = null; }
  try {
    if (q != null) {
      const t = parseTod(q);
      if (t) sessionStorage.setItem(TOD_PREVIEW_KEY, t);
      else if (q.trim().toLowerCase() === 'auto' || q === '') sessionStorage.removeItem(TOD_PREVIEW_KEY);
      if (t) return t;
      if (q.trim().toLowerCase() === 'auto' || q === '') return null;
    }
    return parseTod(sessionStorage.getItem(TOD_PREVIEW_KEY));
  } catch {
    return parseTod(q);
  }
}

/** Settings > Season preview > Time of day: null = Auto (the clock). */
export function setTodPreview(t: TimeOfDay | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (t) sessionStorage.setItem(TOD_PREVIEW_KEY, t);
    else sessionStorage.removeItem(TOD_PREVIEW_KEY);
  } catch { /* storage blocked */ }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(TOD_PARAM)) {
      url.searchParams.delete(TOD_PARAM);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(TOD_EVENT));
}

/** The stored override for the picker (null = Auto). */
export function storedTodPreview(): TimeOfDay | null {
  if (typeof window === 'undefined') return null;
  try { return parseTod(sessionStorage.getItem(TOD_PREVIEW_KEY)); } catch { return null; }
}

/** The slot right now: the admin override, else the local clock. */
export function currentTimeOfDay(now: Date = new Date()): TimeOfDay {
  return readTodOverride() ?? timeOfDayAt(now);
}

/** The slot after the next boundary (null under an override: nothing is coming). Used to prewarm the next wall + stage. */
export function upcomingTimeOfDay(now: Date = new Date()): TimeOfDay | null {
  if (readTodOverride()) return null;
  return timeOfDayAt(new Date(nextTimeOfDayChange(now).getTime() + 1000));
}

// ── the one store ──────────────────────────────────────────────────────────

let current: TimeOfDay = 'night';
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function read() {
  const next = currentTimeOfDay();
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

function arm() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (readTodOverride()) return;                     // pinned by the admin override: no boundary to wait for
  const now = new Date();
  const wait = Math.min(nextTimeOfDayChange(now).getTime() - now.getTime() + 250, 2 ** 31 - 1);
  timer = setTimeout(() => { read(); arm(); }, wait);
}

function onVisible() {
  if (document.visibilityState === 'visible') { read(); arm(); }
}
function onOverride() { read(); arm(); }

function subscribe(l: () => void) {
  if (listeners.size === 0) {
    current = currentTimeOfDay();
    arm();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(TOD_EVENT, onOverride);
    window.addEventListener('popstate', onOverride);
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(TOD_EVENT, onOverride);
      window.removeEventListener('popstate', onOverride);
    }
  };
}

/** The app-wide time of day (night on the server and in the first client render, then the real slot). */
export function useTimeOfDay(): TimeOfDay {
  return useSyncExternalStore(subscribe, () => (listeners.size ? current : currentTimeOfDay()), () => 'night');
}

/** Decode art off the main thread before it is needed (the next time's wall / stage): fire-and-forget, idle. */
export function prewarmArt(urls: readonly string[]): void {
  if (typeof window === 'undefined') return;
  const go = () => {
    for (const u of urls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
      void img.decode?.().catch(() => {});
    }
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(go); else setTimeout(go, 1500);
}
