// The sound pack + the event map (docs/FINISH_SPEC.md U), as pure data so the
// runtime (lib/sounds.ts, lib/sound-events.ts) and the tests share one source.

import { REVEAL } from '@/lib/tile-motion';
import type { HapticKind } from '@/lib/haptics';

/** The 16 samples in public/sounds/<name>.m4a (docs/design/brand/sounds/make-sounds.py). */
export const SOUND_NAMES = [
  'tap', 'delete', 'flip', 'press', 'release', 'hop', 'invalid', 'win',
  'lose', 'celebrate', 'streak', 'tick', 'notify', 'unlock', 'vs', 'whoosh',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

export function soundUrl(name: SoundName): string {
  return `/sounds/${name}.m4a`;
}

/** Master volume. */
export const MASTER_GAIN = 0.6;

/** `tap` varies its pitch ±3% per press so typing never sounds robotic. */
export const TAP_PITCH_JITTER = 0.03;

/** A playbackRate in [1 - 3%, 1 + 3%] from a uniform random number in [0, 1). */
export function tapRate(random: number): number {
  const r = Math.min(1, Math.max(0, random));
  return 1 + (r * 2 - 1) * TAP_PITCH_JITTER;
}

/** The same sample twice inside this window plays once (simultaneous multi-board flips, a popup + its wrapper). */
export const SOUND_DEDUPE_MS = 40;

/** Reveal flips: at most one per 45 ms, so multi-board reveals don't stack. */
export const FLIP_MIN_MS = 45;

/** Partial successes (a found word, a solved group) play `notify` at this volume — never `win`. */
export const PARTIAL_GAIN = 0.7;

/** Points count-up ticks: at most 12 a second. */
export const TICK_MIN_MS = Math.ceil(1000 / 12);

/** Celebrate = success, then a heavy thump this long after. */
export const SECOND_HAPTIC_MS = 140;

/** The app events that make a sound and/or a haptic. */
export type FeedbackEvent =
  | 'key' | 'delete' | 'flip' | 'rowLand' | 'invalid' | 'press' | 'release' | 'hop'
  | 'win' | 'lose' | 'celebrate' | 'streak' | 'tick' | 'notify' | 'unlock' | 'vs' | 'whoosh';

/** FINISH_SPEC U event map (sound · haptic). */
export const FEEDBACK: Record<FeedbackEvent, { sound: SoundName | null; haptics: readonly HapticKind[] }> = {
  key: { sound: 'tap', haptics: ['light'] },
  delete: { sound: 'delete', haptics: ['light'] },
  flip: { sound: 'flip', haptics: ['selection'] },
  rowLand: { sound: null, haptics: ['light'] },
  invalid: { sound: 'invalid', haptics: ['warning'] },
  press: { sound: 'press', haptics: ['soft'] },
  release: { sound: 'release', haptics: [] },
  hop: { sound: 'hop', haptics: [] },
  win: { sound: 'win', haptics: ['success'] },
  lose: { sound: 'lose', haptics: ['soft'] },
  celebrate: { sound: 'celebrate', haptics: ['success', 'heavy'] },
  streak: { sound: 'streak', haptics: ['medium'] },
  tick: { sound: 'tick', haptics: [] },
  notify: { sound: 'notify', haptics: ['light'] },
  unlock: { sound: 'unlock', haptics: ['success'] },
  vs: { sound: 'vs', haptics: ['medium'] },
  whoosh: { sound: 'whoosh', haptics: [] },
};

/** When each tile of a reveal turns over (ms from the reveal start): one `flip` per tile, REVEAL.stagger apart. */
export function revealFlipDelays(tiles: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(tiles)) }, (_, i) => i * REVEAL.stagger);
}

/** A gate that lets a call through at most once per `minMs` (returns true when it may fire). */
export function makeThrottle(minMs: number): (now: number) => boolean {
  let last = -Infinity;
  return (now: number) => {
    if (now - last < minMs) return false;
    last = now;
    return true;
  };
}
