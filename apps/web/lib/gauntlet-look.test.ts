import { describe, expect, it } from 'vitest';
import { GAUNTLET_LOST_POSES, STAGE_FAILED_POSE, stageDots, stagePose, stageRuleLine, starRow } from './gauntlet-look';
import { ART_SIZE } from './art';

describe('Gauntlet stage + finish screens (FINISH_SPEC P, Q)', () => {
  it('gives every upcoming stage its own pose, W proud after the final stage', () => {
    expect([2, 3, 4, 5].map(stagePose)).toEqual(['art-pose-o1-cheer', 'art-pose-d-eureka', 'art-pose-c-telescope', 'art-pose-s-flex']);
    expect(stagePose(null)).toBe('art-pose-w-proud');
    expect(new Set([2, 3, 4, 5, null].map(stagePose)).size).toBe(5);
  });
  it('only uses shipped art', () => {
    for (const n of [STAGE_FAILED_POSE, ...GAUNTLET_LOST_POSES, ...[2, 3, 4, 5, null].map(stagePose), 'art-scene-gauntlet-champion']) {
      expect(ART_SIZE[n as keyof typeof ART_SIZE], n).toBeDefined();
    }
  });
  it('draws the progress dots and the star row', () => {
    expect(stageDots(5, 2)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
    expect(stageDots(5, 5)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(starRow(5, 3)).toEqual([true, true, true, false, false]);
  });
  it('words the stage rule', () => {
    expect(stageRuleLine({ boardCount: 1, maxGuesses: 6 })).toBe('1 board · 6 guesses');
    expect(stageRuleLine({ boardCount: 4, maxGuesses: 9, sequential: true, hasPrefill: true })).toBe('4 boards · 9 guesses · sequential · pre-filled clues');
  });
});
