import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  groupsPuzzleForDay, groupsPuzzleForSeed, groupsDailyNumber, groupsTileOrder, createGroupsState, groupsReduce, groupsMatchRow, reconstructGroups,
  groupsGuessCount, groupsBoardsSolved, groupsLabelTarget, groupsPairTarget, GROUPS_MAX_MISTAKES, type GroupsBank,
} from './groups';
import type { HolidayTable } from '../bank';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'groups-puzzles.json'), 'utf8')) as GroupsBank;
const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;

describe('Kindred bank', () => {
  it('has a year of dailies, an Unlimited pool, holiday sets, and honest puzzles', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(bank.holiday ?? {}).length).toBe(28);
    expect(groupsPuzzleForDay(bank, '2026-09-23', table)?.id).toBe(bank.daily[0].id);
    expect(groupsPuzzleForDay(bank, '2026-12-25', table)?.holiday).toBe('christmas');
    expect(groupsDailyNumber('2026-09-23')).toBe(1);
    expect(bank.extra.some((q) => q.id === groupsPuzzleForSeed(bank, 'unlimited-GROUPS-1')?.id)).toBe(true);
    const ids = new Set<string>();
    for (const p of [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()]) {
      expect(ids.has(p.id), `${p.id} duplicate`).toBe(false); ids.add(p.id);
      expect(p.groups.map((g) => g.tier)).toEqual([1, 2, 3, 4]);
      const words = p.groups.flatMap((g) => g.words);
      expect(new Set(words).size, p.id).toBe(16);
      for (const w of words) expect(w, p.id).toMatch(/^[A-Z]{2,12}$/);
      for (const g of p.groups) expect(g.label.length, p.id).toBeLessThanOrEqual(40);
    }
  });
});

describe('Kindred reducer', () => {
  const p = bank.daily[0];
  const byTier = (t: number) => p.groups.find((g) => g.tier === t)!;

  it('deals the same board for a seed and different boards for different seeds', () => {
    const a = groupsTileOrder(p, 'daily-2026-09-23-GROUPS'), b = groupsTileOrder(p, 'daily-2026-09-23-GROUPS'), c = groupsTileOrder(p, 'other');
    expect(a).toEqual(b); expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(p.groups.flatMap((g) => g.words).sort());
    const s = createGroupsState(p, 'daily-2026-09-23-GROUPS', 0);
    expect(s.tiles).toEqual(a);
  });

  it('selects up to four, solves groups, counts one-aways and misses, repeats are free, four mistakes lose', () => {
    let s = createGroupsState(p, 'fixture', 0);
    s = groupsReduce(s, { type: 'SUBMIT' }); expect(s.lastResult).toBe('short'); expect(s.submissions).toBe(0);
    for (const w of byTier(1).words) s = groupsReduce(s, { type: 'TOGGLE', word: w.toLowerCase() });
    s = groupsReduce(s, { type: 'TOGGLE', word: byTier(2).words[0] }); expect(s.selected.length).toBe(4);   // fifth ignored
    s = groupsReduce(s, { type: 'SUBMIT' }, 10);
    expect(s.lastResult).toBe('correct'); expect(s.solved.map((g) => g.tier)).toEqual([1]); expect(s.tiles.length).toBe(12); expect(s.events).toEqual([`+1:${byTier(1).words.join(',')}`]);
    // one away: three of tier 2 + one of tier 3
    for (const w of byTier(2).words.slice(0, 3)) s = groupsReduce(s, { type: 'TOGGLE', word: w });
    s = groupsReduce(s, { type: 'TOGGLE', word: byTier(3).words[0] });
    const wrongKey = [...s.selected].sort().join(',');
    s = groupsReduce(s, { type: 'SUBMIT' }, 20);
    expect(s.lastResult).toBe('oneaway'); expect(s.mistakes).toBe(1); expect(s.events.at(-1)).toBe(`x1:${wrongKey}`); expect(s.selected.length).toBe(4);
    s = groupsReduce(s, { type: 'SUBMIT' }, 21); expect(s.lastResult).toBe('repeat'); expect(s.mistakes).toBe(1); expect(s.submissions).toBe(2);
    s = groupsReduce(s, { type: 'DESELECT' }); expect(s.selected).toEqual([]);
    expect(groupsGuessCount(s)).toBe(2); expect(groupsBoardsSolved(s)).toBe(1);
    // two of tier 2 + two of tier 3 → plain miss
    for (const w of [...byTier(2).words.slice(0, 2), ...byTier(3).words.slice(0, 2)]) s = groupsReduce(s, { type: 'TOGGLE', word: w });
    s = groupsReduce(s, { type: 'SUBMIT' }, 30); expect(s.lastResult).toBe('wrong'); expect(s.mistakes).toBe(2);
    // finish the rest correctly
    s = groupsReduce(s, { type: 'DESELECT' });
    for (const t of [2, 3, 4]) { for (const w of byTier(t).words) s = groupsReduce(s, { type: 'TOGGLE', word: w }); s = groupsReduce(s, { type: 'SUBMIT' }, 40 + t); }
    expect(s.status).toBe('won'); expect(s.ended).toBe(true); expect(s.endTime).toBe(44); expect(s.tiles).toEqual([]);
    expect(groupsGuessCount(s)).toBe(6); expect(groupsBoardsSolved(s)).toBe(4);
    const row = groupsMatchRow(s);
    expect(row.solutions).toHaveLength(4); expect(row.solutions[0].startsWith('1|')).toBe(true);
    const r = reconstructGroups(row.solutions, row.guesses)!;
    expect(r.solvedTiers).toEqual([1, 2, 3, 4]); expect(r.mistakes).toBe(2); expect(r.oneAways).toBe(1); expect(r.submissions).toBe(6); expect(r.solved).toBe(true);
  });

  it('loses after four mistakes and reports groups found + 4', () => {
    let s = createGroupsState(p, 'fixture', 0);
    for (const w of byTier(1).words) s = groupsReduce(s, { type: 'TOGGLE', word: w });
    s = groupsReduce(s, { type: 'SUBMIT' });
    const wrongSets = [
      [...byTier(2).words.slice(0, 2), ...byTier(3).words.slice(0, 2)],
      [...byTier(2).words.slice(0, 2), ...byTier(4).words.slice(0, 2)],
      [...byTier(3).words.slice(0, 2), ...byTier(4).words.slice(0, 2)],
      [byTier(2).words[0], byTier(3).words[0], byTier(4).words[0], byTier(2).words[3]],
    ];
    for (const set of wrongSets) { s = groupsReduce(s, { type: 'DESELECT' }); for (const w of set) s = groupsReduce(s, { type: 'TOGGLE', word: w }); s = groupsReduce(s, { type: 'SUBMIT' }, 99); }
    expect(s.mistakes).toBe(GROUPS_MAX_MISTAKES); expect(s.status).toBe('lost'); expect(s.ended).toBe(true); expect(s.endTime).toBe(99); expect(s.selected).toEqual([]);
    expect(groupsGuessCount(s)).toBe(1 + 4);
    const before = s; s = groupsReduce(s, { type: 'TOGGLE', word: byTier(2).words[0] }); expect(s).toBe(before);
  });

  it('hints name the easiest unsolved category and ring a pair; shuffle is seeded', () => {
    let s = createGroupsState(p, 'fixture', 0);
    expect(groupsLabelTarget(s)?.tier).toBe(1);
    s = groupsReduce(s, { type: 'HINT_LABEL' }); expect(s.revealedTiers).toEqual([1]); expect(s.hintsUsed).toBe(1); expect(s.events).toEqual(['?c1']);
    s = groupsReduce(s, { type: 'HINT_LABEL' }); expect(s.revealedTiers).toEqual([1, 2]);
    const t = groupsPairTarget(s)!; expect(t.tier).toBe(1); expect(byTier(1).words).toContain(t.pair[0]);
    s = groupsReduce(s, { type: 'HINT_PAIR' }); expect(s.pairs).toEqual([t.pair]); expect(s.hintsUsed).toBe(4); expect(s.events.at(-1)).toBe(`?p:${t.pair.join(',')}`);
    expect(groupsPairTarget(s)?.tier).toBe(2);
    const tilesBefore = s.tiles;
    s = groupsReduce(s, { type: 'SHUFFLE' }); expect(s.shuffles).toBe(1); expect([...s.tiles].sort()).toEqual([...tilesBefore].sort()); expect(s.events.at(-1)).toBe('~1');
    const again = groupsReduce(groupsReduce(createGroupsState(p, 'fixture', 0), { type: 'HINT_LABEL' }), { type: 'SHUFFLE' });
    expect(again.tiles).toEqual(s.tiles);
    expect(reconstructGroups(['1|a|A,B,C'], [])).toBeNull();
  });
});
