import { describe, expect, it } from 'vitest';
import { flawlessSealLabel, headlineLabel, mascotLabel, placeWord, podiumOpenSpotLabel, podiumPlaceLabel, podiumStageCardLabel, progressLabel } from './a11y-labels';

// 2.8 item 40: the screen-reader labels are real words, never empty, on every input.
describe('a11y labels', () => {
  it('names the places', () => {
    expect([1, 2, 3, 4].map(placeWord)).toEqual(['First', 'Second', 'Third', '#4']);
    expect(podiumOpenSpotLabel(2)).toBe('Second place, open spot');
  });

  it('speaks a podium place in one line', () => {
    expect(podiumPlaceLabel(1, 'doug', '2,005', '4 Guesses · 1m 45s')).toBe('First place, doug, 2,005, 4 Guesses · 1m 45s');
    expect(podiumPlaceLabel(2, 'Sam', '1,980', null)).toBe('Second place, Sam, 1,980');
    expect(podiumPlaceLabel(3, 'Ava', '1,500', '  ')).toBe('Third place, Ava, 1,500');
    expect(podiumStageCardLabel('doug', 1)).toBe('doug, first place. Opens their stage');
  });

  it('speaks the seal, headlines, mascots and the counter', () => {
    expect(flawlessSealLabel(1)).toBe('1 Flawless day in a row');
    expect(flawlessSealLabel(7)).toBe('7 Flawless days in a row');
    expect(headlineLabel(['ALL 8 DAILIES', 'WON TODAY!'])).toBe('ALL 8 DAILIES WON TODAY!');
    expect(headlineLabel('  GOOD   MORNING ')).toBe('GOOD MORNING');
    expect(mascotLabel(true, 'x')).toBe('Your mascot');
    expect(mascotLabel(false, 'doug')).toBe("doug's mascot");
    expect(progressLabel(7, 18)).toBe('7 of 18 played today');
  });

  it('never returns an empty label', () => {
    const all = [
      placeWord(0), podiumOpenSpotLabel(9), podiumPlaceLabel(1, '', ''), podiumStageCardLabel('', 3), flawlessSealLabel(0),
      headlineLabel(''), headlineLabel([]), headlineLabel(['', ' ']), mascotLabel(false), mascotLabel(false, ' '), progressLabel(0, 0),
    ];
    for (const l of all) expect(l.trim().length).toBeGreaterThan(0);
  });
});
