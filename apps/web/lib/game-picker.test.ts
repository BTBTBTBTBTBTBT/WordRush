import { describe, expect, it } from 'vitest';
import { SWEEP_KEY, pickerRows, pickerTileFor } from './game-picker';
import { CORE_MODES } from './modes.generated';

const all = () => true;

describe('game picker rows (FINISH_SPEC C2b / C3)', () => {
  it('puts the Sweep broom 9th, right after the last daily', () => {
    const { wordocious } = pickerRows(all);
    expect(wordocious).toHaveLength(9);
    expect(wordocious.map((t) => t.key)).toEqual(['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'DUEL_6', 'DUEL_7', 'RESCUE', 'GAUNTLET', SWEEP_KEY]);
    expect(wordocious[8]).toMatchObject({ artId: 'sweep', title: 'Daily Sweep' });
  });
  it('a saved player order reorders both rows (Classic stays first, Sweep stays last)', () => {
    const { wordocious, puzzles } = pickerRows(all, { order: { dailies: ['gauntlet', 'practice', 'seven'], puzzles: ['scramble'] } });
    expect(wordocious.map((t) => t.key).slice(0, 4)).toEqual(['DUEL', 'GAUNTLET', 'DUEL_7', 'QUORDLE']);
    expect(wordocious[wordocious.length - 1].key).toBe(SWEEP_KEY);
    expect(puzzles[0].key).toBe('SCRAMBLE');
  });
  it('leaves Sweep out when asked', () => {
    expect(pickerRows(all, { sweep: false }).wordocious.map((t) => t.key)).not.toContain(SWEEP_KEY);
  });
  it('lists every daily puzzle, catalog order, all visible', () => {
    const { puzzles } = pickerRows(all);
    expect(puzzles.length).toBeGreaterThanOrEqual(8);
    expect(puzzles.every((t) => t.key && t.artId && t.accent.startsWith('#'))).toBe(true);
    expect(new Set(puzzles.map((t) => t.key)).size).toBe(puzzles.length);
  });
  it('filters remote-gated games', () => {
    const gated = CORE_MODES.find((m) => m.flagKey && m.dailyEligible && !m.homeWide);
    const rows = pickerRows((k) => k == null);
    if (gated) expect(rows.wordocious.map((t) => t.key)).not.toContain(gated.dbKey);
    expect(rows.wordocious.at(-1)?.key).toBe(SWEEP_KEY);
  });
  it('finds a tile by key', () => {
    const rows = pickerRows(all);
    expect(pickerTileFor(rows, 'DUEL')?.artId).toBe('practice');
    expect(pickerTileFor(rows, SWEEP_KEY)?.artId).toBe('sweep');
    expect(pickerTileFor(rows, 'NOPE')).toBeNull();
  });
});
