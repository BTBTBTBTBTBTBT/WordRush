import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Haptics (docs/FINISH_SPEC.md U): one `haptic(kind)` for the whole app.
// Web: navigator.vibrate where supported (Android Chrome), a no-op elsewhere
// (iOS Safari has no vibrate). Native shells (Capacitor) use the Taptic
// engine. The Settings "Haptics" toggle (`pref-haptics`, default on) gates
// everything; Reduce Motion does not. Never throws.

export type HapticKind = 'light' | 'medium' | 'heavy' | 'soft' | 'selection' | 'success' | 'warning';
/** @deprecated the old name — every intensity is a HapticKind now. */
export type Intensity = HapticKind;

export const HAPTICS_PREF_KEY = 'pref-haptics';
export const HAPTICS_PREF_EVENT = 'wordocious:haptics-pref';

/** navigator.vibrate patterns per kind (ms; arrays = on/off/on…). */
export const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 4,
  soft: 6,
  light: 8,
  medium: 15,
  heavy: 30,
  success: [12, 60, 18],
  warning: [20, 50, 20],
};

/** Two haptics closer than this collapse into the first (a popup and the screen that opened it firing together). */
export const HAPTIC_DEDUPE_MS = 50;

let _isNative: boolean | null = null;
function isNative(): boolean {
  if (_isNative === null) {
    try { _isNative = Capacitor.isNativePlatform(); } catch { _isNative = false; }
  }
  return _isNative;
}

/** The Haptics pref (default on). */
export function isHapticsOn(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(HAPTICS_PREF_KEY) !== 'false'; } catch { return true; }
}

export function setHapticsOn(on: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(HAPTICS_PREF_KEY, String(on)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent(HAPTICS_PREF_EVENT, { detail: on })); } catch { /* old browsers */ }
}

function vibrateWeb(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* blocked before a user gesture, or unsupported */ }
}

function nativeHaptic(kind: HapticKind): void {
  const swallow = (p: Promise<unknown> | undefined) => { p?.catch?.(() => {}); };
  switch (kind) {
    case 'light':
    case 'soft':
      swallow(Haptics.impact({ style: ImpactStyle.Light }));
      break;
    case 'medium':
      swallow(Haptics.impact({ style: ImpactStyle.Medium }));
      break;
    case 'heavy':
      swallow(Haptics.impact({ style: ImpactStyle.Heavy }));
      break;
    case 'selection':
      // iOS needs selectionStart() before selectionChanged() fires.
      Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {});
      break;
    case 'success':
      swallow(Haptics.notification({ type: NotificationType.Success }));
      break;
    case 'warning':
      swallow(Haptics.notification({ type: NotificationType.Warning }));
      break;
  }
}

let lastAt = -Infinity;

export function haptic(kind: HapticKind = 'light'): void {
  if (typeof window === 'undefined' || !isHapticsOn()) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastAt < HAPTIC_DEDUPE_MS) return;
  lastAt = now;
  try {
    if (isNative()) nativeHaptic(kind);
    else vibrateWeb(WEB_PATTERNS[kind] ?? WEB_PATTERNS.light);
  } catch { /* never throw from feedback */ }
}
