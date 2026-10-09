// The living mascot (docs/cloud-prompts/06; core avatar-pose.ts): the player's own mascot breathes, blinks, holds its
// saved pose, hops + laughs on a tap and reacts to moments (win = cheer, loss = shrug, streak +1 = hop, level up =
// cheer). Everything here stands down while AVATAR_LIVE_CONFIG.livingMascot is off (the default).
//
// Performance rules (founder: smooth over pretty): only a few mascots animate per screen (the player's own first),
// lists stay still, offscreen / hidden tabs pause, Reduce Motion = still (a tap only shows the laugh). Every frame
// only rewrites the `transform` of a handful of svg groups (no re-render, no layout).

import { AVATAR_LAUGH_RATE, AVATAR_LIVE_CONFIG, type AvatarReaction } from '@wordle-duel/core';

export const LIVING_MASCOT_ON: boolean = AVATAR_LIVE_CONFIG.livingMascot;

/** The window event a moment fires (detail: { kind }). */
export const MASCOT_MOMENT_EVENT = 'wd-mascot-moment';

/** Tell the player's living mascot a moment happened (a no-op while the flag is off). */
export function emitMascotMoment(kind: AvatarReaction): void {
  if (!LIVING_MASCOT_ON || typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(MASCOT_MOMENT_EVENT, { detail: { kind } })); } catch { /* never throw */ }
}

/** Which cast giggle a body laughs with (pitched per body by AVATAR_LAUGH_RATE). */
export const BODY_LAUGH: Readonly<Record<string, string>> = {
  classic: 'w', tall: 'i', wide: 'u', blob: 'o1', bean: 's', star: 'o2', drop: 'd', pear: 'r', cloud: 'u', chunky: 'c', mini: 'o3', hex: 'd',
};
export const bodyLaughRate = (body: string) => AVATAR_LAUGH_RATE[body] ?? 1;

// ── The animation budget: at most maxAnimated living mascots run at once; the player's own come first ──────────
const running = new Set<object>();
const waiting: Array<{ key: object; own: boolean; start: () => void }> = [];

/** Ask to animate; `start` runs now or once a slot frees. Returns the release function. */
export function claimLivingSlot(key: object, own: boolean, start: () => void): () => void {
  const max = AVATAR_LIVE_CONFIG.maxAnimated;
  if (running.size < max) { running.add(key); start(); }
  else if (own) {
    // the player's own mascot bumps a non-own one
    const victim = waiting.length ? null : [...running][running.size - 1];
    if (victim) running.delete(victim);
    running.add(key); start();
  } else waiting.push({ key, own, start });
  return () => {
    running.delete(key);
    const i = waiting.findIndex((w) => w.key === key);
    if (i >= 0) waiting.splice(i, 1);
    const next = waiting.sort((a, b) => Number(b.own) - Number(a.own)).shift();
    if (next && running.size < max) { running.add(next.key); next.start(); }
  };
}

/** Test hook: how many living mascots hold a slot. */
export const livingSlotsInUse = () => running.size;
