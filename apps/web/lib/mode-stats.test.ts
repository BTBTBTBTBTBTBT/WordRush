import { describe, it, expect } from 'vitest';
import {
  statLines, statPanels, modeAggregates, boardsFromEvents, avg1, guessRowLabel, fewestRecordLabel,
  guessDistributionRange, guessNoun, EMPTY_AGGREGATES, type MatchRow,
} from './mode-stats';
import fixtures from './__fixtures__/mode-stats-fixtures.json';

/**
 * Mode-stats parity guard (web side). The same JSON is asserted by iOS
 * ModeStatsFixtureTests.swift and Android ModeStatsFixtureTest.kt.
 * Regenerate: ../server/node_modules/.bin/tsx scripts/gen-mode-stats-fixtures.ts
 */
describe('mode-stats registry', () => {
  it('reproduces every fixture case: aggregates, lines and panels', () => {
    for (const c of fixtures) {
      const agg = modeAggregates(c.dbKey, c.matches as MatchRow[], c.guessBase);
      expect(agg, `aggregates(${c.dbKey})`).toEqual(c.aggregates);
      expect(statLines(c.dbKey, c.totals, c.semantics, c.guessBase, agg), `lines(${c.dbKey})`).toEqual(c.lines);
      expect(statPanels(c.dbKey, c.semantics), `panels(${c.dbKey})`).toEqual(c.panels);
    }
  });

  it('covers every custom game with an empty case and a matches case', () => {
    for (const key of ['SUDOKU', 'REGIONS', 'LADDER', 'SCRAMBLE', 'WORDSEARCH', 'HUB', 'CROSSWORD', 'CRYPTOGRAM', 'GROUPS']) {
      const cases = fixtures.filter((c) => c.dbKey === key);
      expect(cases.some((c) => c.totals.totalGames === 0 && c.matches.length === 0), `${key} empty`).toBe(true);
      expect(cases.some((c) => c.matches.length >= 3), `${key} matches`).toBe(true);
      for (const c of cases) expect(c.lines, `${key} has eight cells`).toHaveLength(8);
      for (const c of cases) for (const l of c.lines) {
        expect(l.label.length, `${key} label "${l.label}" fits the grid`).toBeLessThanOrEqual(12);
        expect(l.value, `${key} ${l.label}`).not.toMatch(/NaN|undefined|^0s$/);
      }
    }
  });

  it('the default profile is exactly the word modes\' eight cells, in order', () => {
    const lines = statLines('DUEL', { wins: 41, losses: 6, totalGames: 47, bestScore: 2, fastestTime: 125, streak: 3, bestStreak: 12 });
    expect(lines.map((l) => l.label)).toEqual(['Wins', 'Losses', 'Games', 'Win Rate', 'Best', 'Fastest', 'Streak', 'Best Streak']);
    expect(lines.map((l) => l.value)).toEqual(['41', '6', '47', '87%', '2', '2m 5s', '3', '12']);
    expect(statLines('DUEL', { wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0 }).map((l) => l.value))
      .toEqual(['0', '0', '0', '0%', '-', '-', '0', '0']);
    // A word mode ignores aggregates entirely.
    expect(statLines('QUORDLE', { wins: 1, losses: 0, totalGames: 1, bestScore: 5, fastestTime: 60, streak: 1, bestStreak: 1 }, 'guesses', 4, { ...EMPTY_AGGREGATES, wins: 99 })[0].value).toBe('1');
  });

  it('the custom profiles read their own eight cells', () => {
    const t = { wins: 1, losses: 0, totalGames: 1, bestScore: 1, fastestTime: 300, streak: 1, bestStreak: 1 };
    const labels = (k: string, s: string, b: number) => statLines(k, t, s, b).map((l) => l.label);
    expect(labels('SUDOKU', 'mistakes', 1)).toEqual(['Wins', 'Losses', 'Win Rate', 'Clean', 'Avg Mistakes', 'Fastest', 'No-hint Wins', 'Streak']);
    expect(labels('REGIONS', 'mistakes', 1)).toEqual(labels('SUDOKU', 'mistakes', 1));
    expect(labels('LADDER', 'overPar', 1)).toEqual(['Wins', 'Losses', 'Par Rate', 'Avg Over Par', 'Fastest Par', 'No-hint Wins', 'Streak', 'Best Streak']);
    expect(labels('SCRAMBLE', 'checks', 5)).toEqual(['Wins', 'Losses', 'Win Rate', 'Clean', 'Avg Checks', 'Fastest', 'Words Solved', 'Streak']);
    expect(labels('WORDSEARCH', 'misses', 10)).toEqual(['Cleared', 'Losses', 'Win Rate', 'Clean', 'Fastest', 'Avg Time', 'Sec / Word', 'Streak']);
    expect(labels('HUB', 'rank', 1)).toEqual(['Days Played', 'Hubbub+', 'Pandemonium', 'Best Rank', 'Avg % Max', 'Pangrams', 'Longest Word', 'Streak']);
    expect(labels('CROSSWORD', 'checks', 1)).toEqual(['Wins', 'Losses', 'Win Rate', 'Clean', 'No-hint Wins', 'Fastest', 'Avg Time', 'Streak']);
    expect(labels('CRYPTOGRAM', 'checks', 1)).toEqual(labels('CROSSWORD', 'checks', 1));
    expect(labels('GROUPS', 'guesses', 4)).toEqual(['Wins', 'Losses', 'Win Rate', 'Perfect', 'Avg Mistakes', 'Hardest 1st', 'Fastest', 'Streak']);
    // Best Rank is a rank NAME, never a number; ProperNoundle keeps the word grid.
    expect(statLines('HUB', { ...t, bestScore: 4 }, 'rank', 1)[3].value).toBe('Hubbub');
    expect(statLines('PROPERNOUNDLE', t)[4].label).toBe('Best');
  });

  it('is robust to no data: dashes and 0%, never NaN or 0s', () => {
    const zero = { wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0 };
    for (const [k, s, b] of [['SUDOKU', 'mistakes', 1], ['LADDER', 'overPar', 1], ['SCRAMBLE', 'checks', 5], ['WORDSEARCH', 'misses', 10], ['HUB', 'rank', 1], ['CROSSWORD', 'checks', 1], ['GROUPS', 'guesses', 4]] as const) {
      for (const l of statLines(k, zero, s, b)) expect(l.value, `${k} ${l.label}`).toMatch(/^(-|0|0%)$/);
    }
    expect(avg1(0, 0)).toBe('-');
    expect(avg1(7, 4, 1)).toBe('0.8');
    expect(avg1(5, 5, 1)).toBe('0.0');
    expect(avg1(3, 4, 1)).toBe('0.0'); // never negative
  });

  it('rebuilds boards from the event log when a matches row has none stored', () => {
    const base = { completed: true, time_seconds: 100, hints_used: 0, solutions: [] as string[] };
    expect(boardsFromEvents('SCRAMBLE', { ...base, guess_count: 6, player1_guesses: ['0✓BREAD', '1✗PAGER', '1✓PAGER', '2H', '3h__N___'] })).toBe(3);
    expect(boardsFromEvents('GROUPS', { ...base, guess_count: 5, player1_guesses: ['x0:A,B,C,D', '+1:A,B,C,D', '+3:E,F,G,H'] })).toBe(2);
    expect(boardsFromEvents('WORDSEARCH', { ...base, guess_count: 11, player1_guesses: ['+CAT', 'x 0,0>1,1', '?DOG', '+DOG'] })).toBe(2);
    // Hubbub: TRAIN 5 + RETINAL 14 = 19 of 60 → floor(19 × 20 / 60) = 6.
    expect(boardsFromEvents('HUB', { ...base, guess_count: 4, player1_guesses: ['+TRAIN', '=TALER', '+RETINAL'], solutions: ['id', 'ATLNEIR', '60', '24', '2'] })).toBe(6);
    expect(boardsFromEvents('SUDOKU', { ...base, guess_count: 1, player1_guesses: [] })).toBe(1);
    expect(boardsFromEvents('SUDOKU', { ...base, completed: false, guess_count: 4, player1_guesses: [] })).toBe(0);
    // A stored boards_solved wins over the rebuild.
    const agg = modeAggregates('HUB', [{ ...base, guess_count: 3, boards_solved: 15, total_boards: 20, player1_guesses: ['+TRAIN'], solutions: ['id', 'ATLNEIR', '60'] }], 1);
    expect([agg.boardsSolved, agg.boardsTotal]).toEqual([15, 20]);
  });

  it('aggregates are order-independent', () => {
    const rows = fixtures.find((c) => c.dbKey === 'HUB' && c.matches.length > 0)!.matches as MatchRow[];
    expect(modeAggregates('HUB', [...rows].reverse(), 1)).toEqual(modeAggregates('HUB', rows, 1));
  });

  it('panels: histograms only for Kindred and Muddle among the custom games; ProperNoundle keeps its distribution but no word cards', () => {
    expect(statPanels('GAUNTLET').guessDistribution).toBe(false);
    expect(statPanels('GAUNTLET').stageBreakdown).toBe(true);
    expect(statPanels('DUEL').topWords).toBe(true);
    expect(statPanels('PROPERNOUNDLE')).toEqual({ guessDistribution: true, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false });
    for (const k of ['GROUPS', 'SCRAMBLE']) expect(statPanels(k, k === 'GROUPS' ? 'guesses' : 'checks').guessDistribution, k).toBe(true);
    for (const k of ['SUDOKU', 'REGIONS', 'LADDER', 'WORDSEARCH', 'HUB', 'CROSSWORD', 'CRYPTOGRAM']) {
      const p = statPanels(k, 'mistakes');
      expect(p, k).toEqual({ guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false });
    }
    expect(guessDistributionRange('GROUPS')).toEqual({ min: 4, max: 7 });
    expect(guessDistributionRange('SCRAMBLE')).toEqual({ min: 5, max: 13 });
    expect(guessDistributionRange('DUEL')).toBeNull();
    expect(guessNoun('checks')).toEqual({ one: 'check', many: 'checks' });
    expect(guessNoun('guesses').many).toBe('guesses');
  });

  it('leaderboard rows and records read through the semantics', () => {
    expect(guessRowLabel('guesses', 1, 4)).toBe('4 Guesses');
    expect(guessRowLabel('guesses', 1, 1)).toBe('1 Guess');
    expect(guessRowLabel('mistakes', 1, 1)).toBe('0 Mistakes');
    expect(guessRowLabel('mistakes', 1, 2)).toBe('1 Mistake');
    expect(guessRowLabel('checks', 5, 5)).toBe('5 Checks');
    expect(guessRowLabel('checks', 1, 3)).toBe('2 Checks');
    expect(guessRowLabel('misses', 10, 12)).toBe('2 Misses');
    expect(guessRowLabel('overPar', 1, 1)).toBe('Par');
    expect(guessRowLabel('overPar', 1, 3)).toBe('+2 over par');
    expect(guessRowLabel('rank', 1, 4)).toBe('Hubbub');
    expect(fewestRecordLabel('guesses')).toBe('Fewest Guesses');
    expect(fewestRecordLabel('mistakes')).toBe('Fewest Mistakes');
    expect(fewestRecordLabel('checks')).toBe('Fewest Checks');
    expect(fewestRecordLabel('overPar')).toBe('Best vs Par');
    expect(fewestRecordLabel('misses')).toBe('Fewest Misses');
    expect(fewestRecordLabel('rank')).toBe('Best Rank');
  });
});
