import { describe, expect, it } from 'vitest';
import { DAY_HEADLINE, HEADLINE, PAGE_HEADLINE, dayPropPair, headlineMaxWidth } from './headline';
import { ART_SIZE } from './art';

describe('calmer top headlines (FINISH_SPEC N1)', () => {
  it('caps page titles at 300 wide and 64 tall', () => {
    expect(HEADLINE).toEqual({ widthPct: 62, maxWidth: 300, maxHeight: 64 });
    for (const name of Object.keys(ART_SIZE).filter((n) => /^art-title(cast)?-/.test(n))) {
      const [w, h] = ART_SIZE[name as keyof typeof ART_SIZE];
      const maxW = headlineMaxWidth(w, h);
      expect(maxW, name).toBeLessThanOrEqual(300);
      expect((maxW * h) / w, name).toBeLessThanOrEqual(64.5);
    }
  });
  it('caps page top titles at 52 tall and leaves the section rule alone (BJ7)', () => {
    expect(PAGE_HEADLINE).toEqual({ widthPct: 62, maxWidth: 300, maxHeight: 52 });
    expect(HEADLINE.maxHeight).toBe(64);
    for (const name of Object.keys(ART_SIZE).filter((n) => /^art-title(cast)?-/.test(n))) {
      const [w, h] = ART_SIZE[name as keyof typeof ART_SIZE];
      const maxW = headlineMaxWidth(w, h, PAGE_HEADLINE);
      expect((maxW * h) / w, name).toBeLessThanOrEqual(52.5);
      expect(maxW, name).toBeLessThanOrEqual(headlineMaxWidth(w, h));
    }
  });
  it('caps the day title at 124 tall, up to 88% wide (founder 10-05)', () => {
    expect(DAY_HEADLINE.widthPct).toBe(88);
    const [w, h] = ART_SIZE['art-day-monday'];
    expect((headlineMaxWidth(w, h, DAY_HEADLINE) * h) / w).toBeLessThanOrEqual(124.5);
    expect((headlineMaxWidth(w, h, DAY_HEADLINE) * h) / w).toBeGreaterThanOrEqual(120);
  });
  it('pairs the day props, one per side, never a lone prop', () => {
    expect(dayPropPair(['a', 'b', 'c', 'd'], 278)).toEqual(['c', 'd']);
    expect(dayPropPair(['a', 'b', 'c', 'd'], 3)).toEqual(['d', 'a']);
    expect(dayPropPair(['a'], 3)).toBeNull();
  });
});
