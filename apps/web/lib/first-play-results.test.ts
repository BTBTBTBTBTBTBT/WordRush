import { describe, expect, it } from 'vitest';
import { keysShowResults } from './first-play-results';

const store: Record<string, string> = {
  'wordle-duel-stats-DUEL': JSON.stringify({ gamesPlayed: 3 }),
  'wordle-duel-stats-QUORDLE': JSON.stringify({ gamesPlayed: 0 }),
  'wordocious-session-OCTORDLE-2026-10-09': '{}',
  'wordocious-hub-daily': '{}',
};
const keys = Object.keys(store);
const read = (k: string) => store[k] ?? null;

describe('first-play results', () => {
  it('sees games the player has played', () => {
    expect(keysShowResults('classic', keys, read)).toBe(true);
    expect(keysShowResults('octoword', keys, read)).toBe(true);
    expect(keysShowResults('hubbub', keys, read)).toBe(true);
  });
  it('does not see games they have not', () => {
    expect(keysShowResults('quadword', keys, read)).toBe(false);
    expect(keysShowResults('muddle', keys, read)).toBe(false);
    expect(keysShowResults('unknown', keys, read)).toBe(false);
    expect(keysShowResults('classic', [], read)).toBe(false);
  });
});
