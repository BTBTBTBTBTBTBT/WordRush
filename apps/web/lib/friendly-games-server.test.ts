import { describe, expect, it } from 'vitest';
import { hasWordPrefix, isListWord, passWordOk } from './friendly-games-server';

describe('friendly games word checks', () => {
  it('words and prefixes across the 5–7 letter lists', () => {
    expect(isListWord('crane')).toBe(true);
    expect(isListWord('ghosts')).toBe(true);
    expect(isListWord('zzzzz')).toBe(false);
    expect(hasWordPrefix('GHO')).toBe(true);
    expect(hasWordPrefix('QZX')).toBe(false);
    expect(passWordOk('CRANE')).toBe(true);
  });
});
