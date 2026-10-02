import { describe, expect, it } from 'vitest';
import { changedKeyLetters, keyColorDelays, keyRevealSchedule, keyStatesWith, latestGuess, type KeyStates } from './key-reveal';
import { REVEAL } from './tile-motion';

// FINISH_SPEC AQ1: each key takes its color as its tile lands, not after the row.

describe('keyColorDelays', () => {
  it('times each letter to its first tile landing', () => {
    const d = keyColorDelays('crane');
    expect(d).toEqual({ C: REVEAL.landMs(0), R: REVEAL.landMs(1), A: REVEAL.landMs(2), N: REVEAL.landMs(3), E: REVEAL.landMs(4) });
    expect(d.C).toBe(220);
    expect(d.E).toBe(REVEAL.end(5));
  });

  it('uses the first occurrence of a repeated letter and skips spaces', () => {
    expect(keyColorDelays('EERIE').E).toBe(REVEAL.landMs(0));
    expect(keyColorDelays('NEW YORK').Y).toBe(REVEAL.landMs(4));
    expect(keyColorDelays('NEW YORK')[' ']).toBeUndefined();
  });
});

describe('keyRevealSchedule', () => {
  const prev: KeyStates = { S: 'absent' };
  const next: KeyStates = { S: 'absent', C: 'correct', R: 'absent', A: 'present', N: 'absent', E: 'correct' };

  it('colors keys tile by tile, never later than the row', () => {
    const steps = keyRevealSchedule(prev, next, 'CRANE');
    expect(steps.map((s) => s.at)).toEqual([0, 1, 2, 3, 4].map((i) => REVEAL.landMs(i)));
    expect(steps.map((s) => s.letters)).toEqual([['C'], ['R'], ['A'], ['N'], ['E']]);
    expect(Math.max(...steps.map((s) => s.at))).toBeLessThanOrEqual(REVEAL.end(5));
  });

  it('only schedules keys that change', () => {
    const steps = keyRevealSchedule({ C: 'present' }, { C: 'present', R: 'absent' }, 'CRANE');
    expect(steps).toEqual([{ at: REVEAL.landMs(1), letters: ['R'] }]);
    expect(keyRevealSchedule(next, next, 'CRANE')).toEqual([]);
  });

  it('upgrades a key (present → correct) when its tile lands', () => {
    expect(keyRevealSchedule({ A: 'present' }, { A: 'correct' }, 'BRAVE')).toEqual([{ at: REVEAL.landMs(2), letters: ['A'] }]);
  });

  it('applies at once with Reduce Motion, no word, or a reset', () => {
    expect(keyRevealSchedule(prev, next, 'CRANE', true)).toEqual([{ at: 0, letters: ['A', 'C', 'E', 'N', 'R'] }]);
    expect(keyRevealSchedule(prev, next, undefined)).toEqual([{ at: 0, letters: ['A', 'C', 'E', 'N', 'R'] }]);
    expect(keyRevealSchedule(next, {}, 'CRANE')).toEqual([{ at: 0, letters: ['A', 'C', 'E', 'N', 'R', 'S'] }]);
  });

  it('times a multi-board reveal from the one guess (every board at once)', () => {
    const p: KeyStates[] = [{}, {}];
    const n: KeyStates[] = [{ C: 'correct', R: 'absent' }, { C: 'absent', R: 'present' }];
    expect(keyRevealSchedule(p, n, 'CR')).toEqual([
      { at: REVEAL.landMs(0), letters: ['C'] },
      { at: REVEAL.landMs(1), letters: ['R'] },
    ]);
    expect(keyRevealSchedule(p, [{}, {}, {}], 'CR')).toEqual([]);
    expect(keyRevealSchedule([{}], [{ C: 'correct' }, {}], 'CR')).toEqual([{ at: 0, letters: ['C'] }]);
  });

  it('waits for the row end for letters not in the word', () => {
    expect(keyRevealSchedule({}, { Q: 'absent' }, 'CRANE')).toEqual([{ at: REVEAL.end(5), letters: ['Q'] }]);
  });
});

describe('keyStatesWith', () => {
  it('moves only the given letters to their new state', () => {
    const prev: KeyStates = { A: 'present', S: 'absent' };
    const next: KeyStates = { A: 'correct', S: 'absent', C: 'correct' };
    expect(keyStatesWith(prev, next, new Set(['C']))).toEqual({ A: 'present', S: 'absent', C: 'correct' });
    expect(keyStatesWith(prev, next, new Set(['A', 'C']))).toEqual(next);
    expect(keyStatesWith<KeyStates>({ A: 'absent' }, {}, new Set(['A']))).toEqual({});
  });

  it('works per board', () => {
    const out = keyStatesWith<KeyStates[]>([{}, { R: 'absent' }], [{ C: 'correct', R: 'present' }, { C: 'absent', R: 'absent' }], new Set(['C']));
    expect(out).toEqual([{ C: 'correct' }, { C: 'absent', R: 'absent' }]);
  });

  it('changedKeyLetters spots every board', () => {
    expect(changedKeyLetters([{ A: 'absent' }, {}], [{ A: 'absent' }, { B: 'present' }])).toEqual(['B']);
  });
});

describe('latestGuess', () => {
  it('is the newest guess on the board with the most guesses', () => {
    expect(latestGuess([{ guesses: ['CRANE'] }, { guesses: ['CRANE', 'SLOTH'] }])).toBe('SLOTH');
    expect(latestGuess([{ guesses: [] }])).toBeUndefined();
    expect(latestGuess([])).toBeUndefined();
  });
});
