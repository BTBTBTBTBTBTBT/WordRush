import { describe, it, expect } from 'vitest';
import { rebuildPNRow } from './reconstruct';
import { normalizeString } from './game-logic';

/**
 * Guards the ProperNoundle half of the hint-row bug class. The reported case:
 * a "Sam Smith" daily played on native and viewed on wordocious.com rendered
 * the revealed I and H stacked at slot 0 in gray, because the recorded rows
 * went through normalizeString() (which trims the positional padding away).
 */
const ANSWER = 'Sam Smith'; // normalizes to "samsmith" — i@5, h@7
const LEN = normalizeString(ANSWER).length;

/** Indices the card would paint purple. */
const correctIdxs = (row: { tiles: string[] }) =>
  row.tiles.map((t, i) => (t === 'correct' ? i : -1)).filter(i => i >= 0);

describe('rebuildPNRow — recorded hint rows', () => {
  it.each([
    ['iOS space-padded', '     i  '],
    ['web underscore-padded', '_____i__'],
  ])('%s keeps the revealed letter at its real index', (_label, recorded) => {
    const row = rebuildPNRow(recorded, ANSWER);
    expect(correctIdxs(row)).toEqual([5]);
    expect(row.word[5]).toBe('i');
    // The reported symptom: letter at slot 0. It must not reappear.
    expect(row.word[0]).toBe(' ');
    expect(row.tiles[0]).toBe('hint-used');
    expect(row.word).toHaveLength(LEN);
    expect(row.tiles).toHaveLength(LEN);
  });

  it('marks every occurrence of a repeated revealed letter', () => {
    // "samsmith" has s@0,3 and m@2,4.
    const row = rebuildPNRow('s  s    ', ANSWER);
    expect(correctIdxs(row)).toEqual([0, 3]);
  });

  it('clue row (no letter revealed) is a full hint-used row', () => {
    const row = rebuildPNRow('', ANSWER); // iOS stores "" for the clue hint
    expect(row.tiles).toEqual(Array(LEN).fill('hint-used'));
    expect(row.word.trim()).toBe('');
    expect(correctIdxs(row)).toEqual([]);
  });

  it('hint rows are identifiable, so the card can count them', () => {
    // completed-daily-board derives the hint count from 'hint-used' tiles —
    // only a hint row can contain one, since the evaluator never emits it.
    expect(rebuildPNRow('     i  ', ANSWER).tiles).toContain('hint-used');
    expect(rebuildPNRow('', ANSWER).tiles).toContain('hint-used');
    expect(rebuildPNRow('samsmith', ANSWER).tiles).not.toContain('hint-used');
  });
});

describe('rebuildPNRow — real guesses still go through the evaluator', () => {
  it('scores a winning guess as all-correct', () => {
    const row = rebuildPNRow('samsmith', ANSWER);
    expect(row.word).toBe('samsmith');
    expect(row.tiles).toEqual(Array(LEN).fill('correct'));
  });

  it('scores a wrong guess positionally', () => {
    const row = rebuildPNRow('mithsams', ANSWER);
    expect(row.tiles).toHaveLength(LEN);
    expect(row.tiles.every(t => t === 'correct')).toBe(false);
    expect(row.tiles).not.toContain('hint-used');
  });

  it('accepts the display form (spaces/case) of a guess', () => {
    const row = rebuildPNRow('Sam Smith', ANSWER);
    expect(row.word).toBe('samsmith');
    expect(row.tiles).toEqual(Array(LEN).fill('correct'));
  });
});
