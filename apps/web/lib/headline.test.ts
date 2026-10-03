import { describe, expect, it } from 'vitest';
import { DAY_HEADLINE, HEADLINE, headlineMaxWidth } from './headline';
import { ART_SIZE } from './art';

describe('calmer top headlines (FINISH_SPEC N1)', () => {
  it('caps page titles at 300 wide and 64 tall', () => {
    expect(HEADLINE).toEqual({ widthPct: 62, maxWidth: 300, maxHeight: 64 });
    for (const name of Object.keys(ART_SIZE).filter((n) => n.startsWith('art-title-'))) {
      const [w, h] = ART_SIZE[name as keyof typeof ART_SIZE];
      const maxW = headlineMaxWidth(w, h);
      expect(maxW, name).toBeLessThanOrEqual(300);
      expect((maxW * h) / w, name).toBeLessThanOrEqual(64.5);
    }
  });
  it('caps the day title at ~58% and 90 tall (AU2 + BB3)', () => {
    expect(DAY_HEADLINE.widthPct).toBe(58);
    const [w, h] = ART_SIZE['art-day-monday'];
    expect((headlineMaxWidth(w, h, DAY_HEADLINE) * h) / w).toBeLessThanOrEqual(90.5);
  });
});
