import { describe, expect, it } from 'vitest';
import { guessStatParts } from './finished-stat';

describe('guessStatParts', () => {
  it('splits counted stats into value + label', () => {
    expect(guessStatParts('guesses', 1, 4)).toEqual({ value: '4', label: 'guesses' });
    expect(guessStatParts('guesses', 1, 1)).toEqual({ value: '1', label: 'guess' });
    expect(guessStatParts('mistakes', 1, 3)).toEqual({ value: '2', label: 'mistakes' });
    expect(guessStatParts('misses', 0, 1)).toEqual({ value: '1', label: 'miss' });
  });
  it('keeps word stats whole', () => {
    expect(guessStatParts('overPar', 1, 1)).toEqual({ value: 'Par', label: '' });
    expect(guessStatParts('overPar', 1, 3)).toEqual({ value: '+2', label: 'over par' });
    expect(guessStatParts('rank', 1, 4)).toEqual({ value: 'Hubbub', label: 'rank' });
  });
});
