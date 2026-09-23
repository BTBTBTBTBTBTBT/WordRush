import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hubPuzzleForDay, hubPuzzleForSeed, hubDailyNumber, hubIsPangram, hubWordScore, hubRankIndex, hubRankThreshold, hubGuessCount, hubBoardsSolved,
  createHubState, hubReduce, hubMatchRow, reconstructHub, hubRank, hubRankName, HUB_RANKS, HUB_SOLVED_RANK, type HubBank,
} from './hub';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'hub-puzzles.json'), 'utf8')) as HubBank;

describe('Hubbub scoring', () => {
  it('scores words, pangrams and ranks with integer maths', () => {
    expect(hubWordScore('DUDE', 'UDELMNP')).toBe(1);
    expect(hubWordScore('PLUME', 'UDELMNP')).toBe(5);
    expect(hubIsPangram('PENDULUM', 'UDELMNP')).toBe(true);
    expect(hubWordScore('PENDULUM', 'UDELMNP')).toBe(15);
    expect(hubRankIndex(0, 81)).toBe(0);
    expect(hubRankIndex(40, 81)).toBe(5);       // 4000 < 4050 → Racket
    expect(hubRankIndex(41, 81)).toBe(6);       // 4100 ≥ 4050 → Hubbub
    expect(hubRankIndex(81, 81)).toBe(9);
    expect(hubRankThreshold(HUB_SOLVED_RANK, 81)).toBe(41);
    expect(hubGuessCount(9)).toBe(1); expect(hubGuessCount(6)).toBe(4); expect(hubGuessCount(0)).toBe(10);
    expect(hubBoardsSolved(40, 81)).toBe(9); expect(hubBoardsSolved(81, 81)).toBe(20);
    expect(HUB_RANKS.map((r) => r.name)).toEqual(['Hush', 'Murmur', 'Chatter', 'Banter', 'Clamor', 'Racket', 'Hubbub', 'Uproar', 'Thunder', 'Pandemonium']);
  });
});

describe('Hubbub bank', () => {
  it('has a year of dailies from the epoch, an Unlimited pool, and honest puzzles', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(100);
    expect(hubPuzzleForDay(bank, '2026-09-23')?.id).toBe(bank.daily[0].id);
    expect(hubDailyNumber('2026-09-23')).toBe(1);
    expect(bank.extra.some((q) => q.id === hubPuzzleForSeed(bank, 'unlimited-HUB-1')?.id)).toBe(true);
    const sets = new Set<string>();
    for (const p of [...bank.daily, ...bank.extra]) {
      expect(p.letters, p.id).toMatch(/^[A-Z]{7}$/);
      expect(new Set(p.letters).size, p.id).toBe(7);
      expect(p.letters.includes('S'), p.id).toBe(false);
      const key = [...p.letters].sort().join('');
      expect(sets.has(key), `${p.id} letter set reused`).toBe(false); sets.add(key);
      expect(p.words.length).toBeGreaterThanOrEqual(20); expect(p.words.length).toBeLessThanOrEqual(60);
      expect(p.pangrams.length).toBeGreaterThanOrEqual(1);
      for (const w of p.words) { expect(w.includes(p.letters[0]), `${p.id} ${w} centre`).toBe(true); for (const ch of w) expect(p.letters.includes(ch), `${p.id} ${w}`).toBe(true); }
      for (const w of p.bonus) { expect(p.words.includes(w), `${p.id} bonus ${w} also scores`).toBe(false); expect(w.includes(p.letters[0])).toBe(true); }
      expect(p.words.reduce((t, w) => t + hubWordScore(w, p.letters), 0), `${p.id} max`).toBe(p.max);
      for (const pg of p.pangrams) expect(hubIsPangram(pg, p.letters) && p.words.includes(pg), `${p.id} pangram ${pg}`).toBe(true);
    }
  });
});

describe('Hubbub reducer', () => {
  const p = bank.daily[0];   // U·DELMNP

  it('rejects for free, scores words, accepts bonus words for nothing, and finalises once at Hubbub', () => {
    let s = createHubState(p, 'fixture', 0);
    s = hubReduce(s, { type: 'SUBMIT', word: 'DUE' }); expect(s.reject).toBe('short');
    s = hubReduce(s, { type: 'SUBMIT', word: 'MELD' }); expect(s.reject).toBe('centre');
    s = hubReduce(s, { type: 'SUBMIT', word: 'DUES' }); expect(s.reject).toBe('letters');
    s = hubReduce(s, { type: 'SUBMIT', word: 'UUUU' }); expect(s.reject).toBe('notword');
    s = hubReduce(s, { type: 'SUBMIT', word: 'dude' }); expect(s.reject).toBeNull(); expect(s.points).toBe(1); expect(s.events).toEqual(['+DUDE']);
    s = hubReduce(s, { type: 'SUBMIT', word: 'DUDE' }); expect(s.reject).toBe('found');
    const bonus = p.bonus[0];
    s = hubReduce(s, { type: 'SUBMIT', word: bonus }); expect(s.bonusFound).toEqual([bonus]); expect(s.points).toBe(1); expect(s.events.at(-1)).toBe(`=${bonus}`);
    expect(s.status).toBe('playing');
    for (const w of p.words) { if (s.status !== 'playing') break; s = hubReduce(s, { type: 'SUBMIT', word: w }, 77); }
    expect(s.status).toBe('won'); expect(s.endTime).toBe(77); expect(hubRank(s)).toBeGreaterThanOrEqual(HUB_SOLVED_RANK);
    expect(hubRankName(s)).toBe('Hubbub');
    // Play continues after the win — the status stays won, more points land.
    const before = s.points;
    const next = p.words.find((w) => !s.found.includes(w))!;
    s = hubReduce(s, { type: 'SUBMIT', word: next }, 99);
    expect(s.status).toBe('won'); expect(s.points).toBeGreaterThan(before); expect(s.endTime).toBe(77);
  });

  it('hints: "Starts with" shows two letters and a length for one hint, "Reveal" places a word for two', () => {
    let s = createHubState(p, 'fixture', 0);
    s = hubReduce(s, { type: 'HINT_START' });
    expect(s.hinted).toEqual([p.words[0]]); expect(s.hintsUsed).toBe(1); expect(s.events).toEqual([`?${p.words[0].slice(0, 2)}${p.words[0].length}`]);
    s = hubReduce(s, { type: 'HINT_START' });
    expect(s.hinted).toEqual([p.words[0], p.words[1]]);
    s = hubReduce(s, { type: 'HINT_REVEAL' });
    expect(s.found).toEqual([p.words[0]]); expect(s.revealed).toEqual([p.words[0]]); expect(s.hintsUsed).toBe(4); expect(s.events.at(-1)).toBe(`!${p.words[0]}`);
  });

  it('End below Hubbub loses and stops play; End after the win keeps the win', () => {
    let s = createHubState(p, 'fixture', 0);
    s = hubReduce(s, { type: 'SUBMIT', word: 'DUDE' });
    s = hubReduce(s, { type: 'END' }, 30);
    expect(s.status).toBe('lost'); expect(s.ended).toBe(true); expect(s.endTime).toBe(30); expect(s.events.at(-1)).toBe('#');
    expect(hubReduce(s, { type: 'SUBMIT', word: 'DUEL' }).reject).toBe('ended');
    let w = createHubState(p, 'fixture', 0);
    for (const word of p.words) { if (w.status !== 'playing') break; w = hubReduce(w, { type: 'SUBMIT', word }, 5); }
    w = hubReduce(w, { type: 'END' }, 60);
    expect(w.status).toBe('won'); expect(w.ended).toBe(true); expect(w.endTime).toBe(5);
  });

  it('the matches row replays into the same points, rank and words', () => {
    let s = createHubState(p, 'fixture', 0);
    s = hubReduce(s, { type: 'HINT_START' });
    s = hubReduce(s, { type: 'SUBMIT', word: p.bonus[0] });
    for (const w of p.words.slice(0, 6)) s = hubReduce(s, { type: 'SUBMIT', word: w });
    s = hubReduce(s, { type: 'HINT_REVEAL' });
    s = hubReduce(s, { type: 'END' });
    const row = hubMatchRow(s);
    expect(row.solutions).toEqual([p.id, p.letters, String(p.max), String(p.words.length), String(p.pangrams.length)]);
    const r = reconstructHub(row.solutions, row.guesses)!;
    expect(r.found).toEqual(s.found); expect(r.bonusFound).toEqual(s.bonusFound); expect(r.revealed).toEqual(s.revealed);
    expect(r.points).toBe(s.points); expect(r.hintsUsed).toBe(s.hintsUsed); expect(r.rank).toBe(hubRank(s)); expect(r.ended).toBe(true);
    expect(reconstructHub(['x', 'ABC', '1'], [])).toBeNull();
  });
});
