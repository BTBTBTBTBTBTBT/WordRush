import { describe, expect, it } from 'vitest';
import { answerRows, answerTileGap, answerTileSize, countUpValue, fitAnswerTile, popupFormatTime } from './result-popup';

describe('win / lose popup (FINISH_SPEC R1)', () => {
  it('formats time compactly', () => {
    expect(popupFormatTime(48)).toBe('48s');
    expect(popupFormatTime(2117)).toBe('35:17');
  });
  it('sizes the answer tiles to fit the card', () => {
    expect(answerTileSize(['SLIME'])).toBe(30);
    expect(answerTileSize(['A', 'B', 'C', 'D'].map(() => 'CRANE'))).toBe(24);
    expect(answerTileSize(Array(8).fill('CRANE'))).toBe(20);
    expect(answerTileSize(Array(21).fill('CRANE'))).toBe(15);
    expect(answerTileSize(['RAFAELNADAL'])).toBeLessThan(30);
  });
  it('founder 10-02: a phrase answer is one row per word and its tiles fit the card', () => {
    expect(answerRows('Hubble Space  Telescope')).toEqual(['HUBBLE', 'SPACE', 'TELESCOPE']);
    expect(answerRows('SLIME')).toEqual(['SLIME']);
    const words = ['HUBBLE SPACE TELESCOPE'];
    // The tray's inner width on a 320 px phone (card 280 − 40 − 24) and on a roomy one.
    for (const width of [216, 320]) {
      const t = fitAnswerTile(words, width, 1, false);
      expect(9 * t + 8 * answerTileGap(t)).toBeLessThanOrEqual(width);
      expect(t).toBeGreaterThanOrEqual(12);
    }
    expect(fitAnswerTile(words, 320, 1, false)).toBe(answerTileSize(words));
    expect(fitAnswerTile(words, null, 1, false)).toBe(answerTileSize(words));
  });
  it('founder 10-02: multi-board answers fit per column with the check badge', () => {
    const eight = Array(8).fill('CRANE');
    expect(fitAnswerTile(eight, 320, 2, true)).toBe(20);
    const t = fitAnswerTile(eight, 200, 2, true);
    const col = (200 - 12) / 2;
    expect(5 * t + 4 * answerTileGap(t) + Math.max(12, Math.round(t * 0.6)) + 4).toBeLessThanOrEqual(col);
  });
  it('counts points up from 0 to the total', () => {
    expect(countUpValue(2005, 0)).toBe(0);
    expect(countUpValue(2005, 1)).toBe(2005);
    expect(countUpValue(2005, 0.5)).toBeGreaterThan(1002);
  });
});
