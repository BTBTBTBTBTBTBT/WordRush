import { describe, it, expect } from 'vitest';
import { statLines, statPanels } from './mode-stats';
import fixtures from './__fixtures__/mode-stats-fixtures.json';

/**
 * Mode-stats parity guard (web side). The same JSON is asserted by iOS
 * ModeStatsFixtureTests.swift and Android ModeStatsFixtureTest.kt.
 * Regenerate: ../server/node_modules/.bin/tsx scripts/gen-mode-stats-fixtures.ts
 */
describe('mode-stats registry', () => {
  it('reproduces every fixture case', () => {
    for (const c of fixtures) {
      expect(statLines(c.dbKey, c.totals, c.semantics, c.guessBase), `lines(${c.dbKey})`).toEqual(c.lines);
      expect(statPanels(c.dbKey, c.semantics), `panels(${c.dbKey})`).toEqual(c.panels);
    }
  });

  it('the default profile is exactly today\'s eight cells, in order', () => {
    const lines = statLines('DUEL', { wins: 41, losses: 6, totalGames: 47, bestScore: 2, fastestTime: 125, streak: 3, bestStreak: 12 });
    expect(lines.map((l) => l.label)).toEqual(['Wins', 'Losses', 'Games', 'Win Rate', 'Best', 'Fastest', 'Streak', 'Best Streak']);
    expect(lines.map((l) => l.value)).toEqual(['41', '6', '47', '87%', '2', '2m 5s', '3', '12']);
    expect(statLines('DUEL', { wins: 0, losses: 0, totalGames: 0, bestScore: 0, fastestTime: 0, streak: 0, bestStreak: 0 }).map((l) => l.value))
      .toEqual(['0', '0', '0', '0%', '-', '-', '0', '0']);
  });

  it('reads Best through the mode semantics and switches word-only cards off for custom engines', () => {
    expect(statLines('SUDOKU', { wins: 1, losses: 0, totalGames: 1, bestScore: 1, fastestTime: 300, streak: 1, bestStreak: 1 }, 'mistakes', 1)[4].value).toBe('0 mistakes');
    expect(statLines('HUB', { wins: 1, losses: 0, totalGames: 1, bestScore: 4, fastestTime: 300, streak: 1, bestStreak: 1 }, 'rank', 1)[4].value).toBe('Hubbub');
    expect(statPanels('GAUNTLET').guessDistribution).toBe(false);
    expect(statPanels('GAUNTLET').stageBreakdown).toBe(true);
    expect(statPanels('DUEL').topWords).toBe(true);
    expect(statPanels('SUDOKU', 'mistakes').topWords).toBe(false);
  });
});
