import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GAUNTLET_HEADER, gauntletHeaderLabel, medalBox, medalStates } from './gauntlet-header';

describe('Gauntlet header (night art 10-03)', () => {
  it('matches the shipped socket map (docs/design/brand/gauntlet/header-slots.json)', () => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/design/brand/gauntlet/header-slots.json'), 'utf8'));
    expect(GAUNTLET_HEADER.slots).toEqual(json.slots);
  });

  it('cleared beats current; everything after is locked', () => {
    expect(medalStates(5, 2, [0, 1])).toEqual(['cleared', 'cleared', 'current', 'locked', 'locked']);
    expect(medalStates(5, 0, [])).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
    expect(medalStates(5, 4, [0, 1, 2, 3, 4])).toEqual(Array(5).fill('cleared'));
  });

  it('draws each medallion round and centered on its socket', () => {
    const b = medalBox(2);
    expect(b.cx).toBeCloseTo(0.5016);
    // Square on screen: width fraction × aspect = height fraction.
    expect(b.h).toBeCloseTo(b.w * GAUNTLET_HEADER.aspect);
    expect(b.cy + b.h / 2).toBeLessThanOrEqual(1.01);
  });

  it('reads "stage N of 5" for VoiceOver / screen readers', () => {
    expect(gauntletHeaderLabel(2, 5, 'Succession')).toBe('Gauntlet, stage 3 of 5, Succession');
    expect(gauntletHeaderLabel(5, 5, 'OctoWord')).toBe('Gauntlet, stage 5 of 5, OctoWord');
  });
});
