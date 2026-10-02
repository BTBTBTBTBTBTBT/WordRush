import { describe, expect, it } from 'vitest';
import { answerSlotLook, chipSize, coinInk, punchlineSlotLook, usedLetters } from './muddle-look';

describe('Muddle letters (FINISH_SPEC I)', () => {
  it('draws circled slots as coins', () => {
    expect(answerSlotLook({ circled: true, filled: false, pinned: false, solved: false })).toEqual({ kind: 'coin', coin: 'empty', frosted: true });
    expect(answerSlotLook({ circled: true, filled: true, pinned: false, solved: false })).toEqual({ kind: 'coin', coin: 'filled', frosted: false });
    expect(answerSlotLook({ circled: true, filled: true, pinned: true, solved: false })).toEqual({ kind: 'coin', coin: 'hint', frosted: false });
    expect(answerSlotLook({ circled: true, filled: true, pinned: true, solved: true })).toEqual({ kind: 'coin', coin: 'filled', frosted: false });
  });
  it('keeps uncircled slots as square tiles', () => {
    expect(answerSlotLook({ circled: false, filled: false, pinned: false, solved: false })).toEqual({ kind: 'tile', look: 'empty' });
    expect(answerSlotLook({ circled: false, filled: true, pinned: false, solved: false })).toEqual({ kind: 'tile', look: 'correct' });
    expect(answerSlotLook({ circled: false, filled: true, pinned: true, solved: false })).toEqual({ kind: 'tile', look: 'hint' });
    expect(answerSlotLook({ circled: false, filled: true, pinned: false, solved: true })).toEqual({ kind: 'tile', look: 'correct' });
  });
  it('makes the punchline tray gold coins', () => {
    expect(punchlineSlotLook(true)).toEqual({ kind: 'coin', coin: 'punchline', frosted: false });
    expect(punchlineSlotLook(false)).toEqual({ kind: 'coin', coin: 'empty', frosted: true });
  });
  it('inks letters white, dark amber on gold', () => {
    expect(coinInk('filled')).toBe('#ffffff');
    expect(coinInk('hint')).toBe('#ffffff');
    expect(coinInk('punchline')).toBe('#7a3d00');
  });
  it('sizes chips at ~70% and marks used letters by multiset', () => {
    expect(chipSize(38)).toBe(27);
    expect(usedLetters('LEVEL', 'LEV')).toEqual([false, false, false, true, true]);
    expect(usedLetters('ABC', 'ABC')).toEqual([false, false, false]);
  });
});
