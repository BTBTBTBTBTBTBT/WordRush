import { describe, expect, it } from 'vitest';
import { TRIM, compactCardLine, trimPath, trimStops } from './card-trim';

describe('card trim (FINISH_SPEC BH1)', () => {
  it('is one closed path: the band plus one drip per bump', () => {
    const d = trimPath();
    expect(d.startsWith('M0 0H176V9')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(TRIM.bumps);
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it('drips peak exactly `drip` below the band (quadratic control at 2·drip)', () => {
    expect(trimPath(176, 9, 4, 8)).toContain(`Q${(7.5 * 22)} 17 154 9`);
  });

  it('is slim: band + drip stays under a fifth of the 74 card', () => {
    expect(TRIM.band + TRIM.drip).toBeLessThanOrEqual(74 / 5);
  });

  it('runs light → accent → deeper; locked is a flat gray', () => {
    const s = trimStops('#7c3aed');
    expect(s.map(([o]) => o)).toEqual([0, 0.42, 1]);
    expect(s[1][1]).toBe('#7c3aed');
    expect(trimStops('#7c3aed', true).every(([, c]) => !c.includes('7c3aed'))).toBe(true);
  });

  it('keeps a long result on one line with the short form (founder 10-03)', () => {
    expect(compactCardLine('3 guesses · 23s')).toBe('3 guesses · 23s');
    expect(compactCardLine('38 guesses · 10m 46s')).toBe('38g · 10m 46s');
    expect(compactCardLine('12 mistakes · 10m 46s')).toBe('12 miss · 10m 46s');
  });
});
