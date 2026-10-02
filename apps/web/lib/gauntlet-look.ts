import type { PoseArtName } from './art';

// Gauntlet stage + finish screens (docs/FINISH_SPEC.md P, Q). Pure.

export const GAUNTLET_ACCENT = '#d97706';

/**
 * P: the cast pose on the between-stage card, by the UPCOMING stage (1-based):
 * Stage 2 O1 cheering · 3 D eureka · 4 C telescope · 5 S flexing; after the
 * final stage (no next stage — the boss is down) W proud.
 */
export function stagePose(nextStageNumber: number | null): PoseArtName {
  switch (nextStageNumber) {
    case 2: return 'art-pose-o1-cheer';
    case 3: return 'art-pose-d-eureka';
    case 4: return 'art-pose-c-telescope';
    case 5: return 'art-pose-s-flex';
    default: return 'art-pose-w-proud';
  }
}

/** P: a failed run's pose (kind, never sad). */
export const STAGE_FAILED_POSE: PoseArtName = 'art-pose-r-sit';

/** Q: the LOST finish screen's two poses, side by side. */
export const GAUNTLET_LOST_POSES: readonly [PoseArtName, PoseArtName] = ['art-pose-r-cocoa', 'art-pose-i-goodgame'];

export type StageDot = 'done' | 'current' | 'todo';

/** The 5-dot progress row: `cleared` stages done, the next one current (none when the run is over). */
export function stageDots(total: number, cleared: number): StageDot[] {
  return Array.from({ length: Math.max(0, total) }, (_, i) => (i < cleared ? 'done' : i === cleared ? 'current' : 'todo'));
}

/** Q: the 5-star row — `cleared` filled gold, the rest soft gray. */
export function starRow(total: number, cleared: number): boolean[] {
  return Array.from({ length: Math.max(0, total) }, (_, i) => i < cleared);
}

/** The stage's rule pill: "4 boards · 9 guesses · sequential · pre-filled clues". */
export function stageRuleLine(s: { boardCount: number; maxGuesses: number; sequential?: boolean; hasPrefill?: boolean }): string {
  return [
    `${s.boardCount} board${s.boardCount === 1 ? '' : 's'}`,
    `${s.maxGuesses} guesses`,
    s.sequential ? 'sequential' : null,
    s.hasPrefill ? 'pre-filled clues' : null,
  ].filter(Boolean).join(' · ');
}
