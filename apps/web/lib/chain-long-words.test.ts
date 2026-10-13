import { describe, expect, it } from 'vitest';
import { pocketWordBlocked } from '@wordle-duel/core';
import long from '@/data/chain-long-words.json';

// Word Chain's long words (founder 10-13): 8-15 letters, sorted upper case (the server binary-searches it), no word the
// play-word guard refuses, and the founder's own examples in. Keep it a few hundred KB (founder: "not MBs").
describe('chain-long-words.json', () => {
  const words = long as string[];
  it('is sorted, upper case A-Z, 8 to 15 letters, unique', () => {
    expect(words.every((w) => /^[A-Z]{8,15}$/.test(w))).toBe(true);
    expect(words).toEqual([...new Set(words)].sort());
  });
  it('has no blocked word and holds the examples', () => {
    expect(words.filter((w) => pocketWordBlocked(w))).toEqual([]);
    for (const w of ['SERENDIPITOUS', 'STUPENDOUS', 'SMARTPHONE', 'MARSHMALLOWS', 'THERAPIST']) expect(words).toContain(w);
  });
  it('stays small', () => {
    expect(JSON.stringify(words).length).toBeLessThan(450_000);
  });
});
