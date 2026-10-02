import { describe, expect, it } from 'vitest';
import { INFO_ACCENTS, infoAccent, infoHelpTarget } from './info-page';

describe('infoAccent', () => {
  it('rotates through the palette and wraps', () => {
    expect(infoAccent(0)).toBe(INFO_ACCENTS[0]);
    expect(infoAccent(1)).toBe(INFO_ACCENTS[1]);
    expect(infoAccent(INFO_ACCENTS.length)).toBe(INFO_ACCENTS[0]);
    expect(infoAccent(INFO_ACCENTS.length + 2)).toBe(INFO_ACCENTS[2]);
  });
  it('never returns undefined for odd indexes', () => {
    for (const i of [-1, -7, 2.6, Number.NaN, Infinity]) expect(INFO_ACCENTS).toContain(infoAccent(i));
  });
});

describe('infoHelpTarget', () => {
  it('points every info page at How to Play', () => {
    expect(infoHelpTarget('/faq').href).toBe('/how-to-play');
    expect(infoHelpTarget('/guides/classic').href).toBe('/how-to-play');
    expect(infoHelpTarget(null).href).toBe('/how-to-play');
  });
  it('points How to Play itself at the FAQ', () => {
    expect(infoHelpTarget('/how-to-play')).toEqual({ href: '/faq', label: 'FAQ' });
    expect(infoHelpTarget('/how-to-play/').href).toBe('/faq');
  });
});
