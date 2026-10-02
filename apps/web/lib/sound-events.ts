// One call per app moment (docs/FINISH_SPEC.md U): `feedback('win')` plays the
// event's sound and its haptic per the event map in lib/sound-map.ts. Sound off
// mutes the sound, Haptics off skips the haptic; Reduce Motion changes
// neither. Never throws.

import { playSound } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { FEEDBACK, FLIP_MIN_MS, SECOND_HAPTIC_MS, TICK_MIN_MS, makeThrottle, revealFlipDelays, tapRate, type FeedbackEvent } from '@/lib/sound-map';

export type { FeedbackEvent } from '@/lib/sound-map';

const tickGate = makeThrottle(TICK_MIN_MS);
const flipGate = makeThrottle(FLIP_MIN_MS);

export function feedback(event: FeedbackEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const entry = FEEDBACK[event];
    if (!entry) return;
    if (event === 'tick' && !tickGate(performance.now())) return;
    if (event === 'flip' && !flipGate(performance.now())) return;
    if (entry.sound) playSound(entry.sound, entry.sound === 'tap' ? { rate: tapRate(Math.random()) } : undefined);
    const [first, second] = entry.haptics;
    if (first) haptic(first);
    if (second) setTimeout(() => haptic(second), SECOND_HAPTIC_MS);
  } catch { /* never throw from feedback */ }
}

/** `feedback(event)` after `delayMs`; returns a cancel. */
export function scheduleFeedback(event: FeedbackEvent, delayMs: number): () => void {
  if (typeof window === 'undefined') return () => {};
  if (delayMs <= 0) { feedback(event); return () => {}; }
  const t = window.setTimeout(() => feedback(event), delayMs);
  return () => window.clearTimeout(t);
}

/** A reveal of `tiles` tiles starting now: one `flip` per tile, REVEAL.stagger apart. Returns a cancel. */
export function playRevealFlips(tiles: number): () => void {
  const cancels = revealFlipDelays(tiles).map((d) => scheduleFeedback('flip', d));
  return () => cancels.forEach((c) => c());
}

/**
 * A physical Backspace / Delete while a game board is on screen plays `delete`
 * (the on-screen key does too). Not inside text fields, not on key repeat.
 */
export function physicalDeleteFeedback(e: KeyboardEvent): void {
  if (e.repeat || (e.key !== 'Backspace' && e.key !== 'Delete')) return;
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (t && (t.isContentEditable || t.closest('input, textarea, select, [contenteditable="true"]'))) return;
  if (typeof document === 'undefined' || !document.querySelector('[role="grid"], .kkey, .gtile')) return;
  feedback('delete');
}
