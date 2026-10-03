// FINISH_SPEC BJ6 (founder 10-03, plan A): who hosts the Home "Good Morning"
// card. ONE choice, so moving the host (option B: the end of the WORDOCIOUS
// cast row with a "YOU" tag) is a placement change only.
//   • a signed-in player whose resolved avatar is a PHOTO → the photo whole, as
//     a framed portrait (never on a mascot body);
//   • a saved mascot (avatar_config) or a worn cast hero → their full mascot;
//   • everyone else (guests, the seeded default) → W in his wave pose.

import type { AvatarConfig, ResolvedAvatar } from '@wordle-duel/core';

export type HomeHostChoice =
  | { kind: 'photo'; photoUrl: string; config: AvatarConfig }
  | { kind: 'mascot'; config: AvatarConfig }
  | { kind: 'w' };

/** The host for the signed-in player's resolved avatar (null = a guest). */
export function homeHostChoice(resolved: ResolvedAvatar | null | undefined): HomeHostChoice {
  if (!resolved) return { kind: 'w' };
  if (resolved.kind === 'photo' && resolved.photoUrl) return { kind: 'photo', photoUrl: resolved.photoUrl, config: resolved.config };
  if (resolved.kind === 'config' || resolved.kind === 'cast') {
    return { kind: 'mascot', config: { ...resolved.config, display: 'mascot' } };
  }
  return { kind: 'w' };
}

/** The host box (≈ 2x the old 52 corner host) and the portrait's share of it. */
export const HOME_HOST_SIZE = 84;
export const HOME_HOST_PORTRAIT = Math.round(HOME_HOST_SIZE * 0.86);

/**
 * During the celebration moment art the W host steps out (opacity 0, keeps
 * its slot); the player's own host stays.
 */
export function homeHostHidden(choice: HomeHostChoice, celebrating: boolean): boolean {
  return celebrating && choice.kind === 'w';
}

// The wave plays ONCE per launch (page load), when Home first appears.
let waved = false;

/** True the first time it's asked per launch (then false). */
export function takeHomeHostWave(): boolean {
  if (waved) return false;
  waved = true;
  return true;
}

export function __resetHomeHostWaveForTests(): void {
  waved = false;
}
