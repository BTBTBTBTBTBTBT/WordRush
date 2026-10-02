import { describe, expect, it } from 'vitest';
import { answerTileSize, countUpValue, popupFormatTime } from './result-popup';

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
  it('counts points up from 0 to the total', () => {
    expect(countUpValue(2005, 0)).toBe(0);
    expect(countUpValue(2005, 1)).toBe(2005);
    expect(countUpValue(2005, 0.5)).toBeGreaterThan(1002);
  });
});
