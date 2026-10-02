import { describe, expect, it } from 'vitest';
import { leaderboardTitle } from '@wordle-duel/core';
import { ART_SIZE, DAY_ART, artLabel, isLetteringArt } from './art';

// FINISH_SPEC AB: every lettering image (page / day / game titles, moments) in
// the art registry has a real accessible name (the words it shows); decorative
// art has none (it renders alt="" aria-hidden).

const names = Object.keys(ART_SIZE);

describe('art labels (FINISH_SPEC AB)', () => {
  it('covers some lettering art', () => {
    expect(names.filter(isLetteringArt).length).toBeGreaterThan(40);
  });

  it.each(names.filter(isLetteringArt))('%s has a non-empty label', (name) => {
    const label = artLabel(name);
    expect(label.trim().length).toBeGreaterThan(0);
    expect(label).not.toMatch(/^art-/);
  });

  it('decorative art has no label', () => {
    for (const n of names.filter((x) => !isLetteringArt(x))) expect(artLabel(n)).toBe('');
  });

  it('day titles say the same words as core leaderboardTitle', () => {
    // 2026-09-27 is a Sunday; DAY_ART is Sunday first.
    DAY_ART.forEach((name, i) => {
      const day = new Date(Date.UTC(2026, 8, 27 + i)).toISOString().slice(0, 10);
      expect(artLabel(name).toUpperCase()).toBe(leaderboardTitle(day));
    });
  });

  it('moment and game labels read as words', () => {
    expect(artLabel('art-moment-victory')).toBe('Victory!');
    expect(artLabel('art-game-six')).toBe('Classic Six');
    expect(artLabel('art-title-records')).toBe('All-Time Records');
  });
});
