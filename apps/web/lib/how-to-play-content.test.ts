import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILIES_ORDER, DEFAULT_PUZZLES_ORDER, POCKET_HELP } from '@wordle-duel/core';
import { HOW_TO_PLAY } from './how-to-play-content';
import { MODE_BY_ID } from './modes.generated';

const section = (title: string) => HOW_TO_PLAY.find((s) => s.title === title)!;

describe('How to Play is sectioned with every game its own entry (item 36)', () => {
  it('sections in order: basics, Dailies, Puzzles, VS + bots, Pocket games, sweeps/streaks/XP', () => {
    const titles = HOW_TO_PLAY.map((s) => s.title);
    expect(titles.slice(0, 6)).toEqual(['The Basics', 'Dailies', 'Puzzles', 'VS Battle & Bots', 'Pocket Games', 'Sweeps, Streaks & XP']);
  });
  it('Dailies: the eight word games in the default order, each with 2-3 plain lines', () => {
    const games = section('Dailies').games!;
    expect(games.map((g) => g.id)).toEqual([...DEFAULT_DAILIES_ORDER]);
    for (const g of games) {
      expect(g.title, g.id).toBe(MODE_BY_ID[g.id].title);
      expect(g.lines.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.lines.length, g.id).toBeLessThanOrEqual(3);
    }
  });
  it('Puzzles: the ten titles in the default order, each its own entry', () => {
    const games = section('Puzzles').games!;
    expect(games.map((g) => g.id)).toEqual([...DEFAULT_PUZZLES_ORDER]);
    for (const g of games) {
      expect(g.title, g.id).toBe(MODE_BY_ID[g.id].title);
      expect(g.lines.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.lines.length, g.id).toBeLessThanOrEqual(3);
    }
  });
  it('Pocket games: all six, titled like the pocket help cards', () => {
    const games = section('Pocket Games').games!;
    expect(games.map((g) => g.id).sort()).toEqual(Object.keys(POCKET_HELP).map((k) => `pocket-${k}`).sort());
    for (const g of games) expect(g.title).toBe(POCKET_HELP[g.id.replace('pocket-', '') as keyof typeof POCKET_HELP].title);
  });
  it('VS Battle has its entry and the bots are named', () => {
    const vs = section('VS Battle & Bots');
    expect(vs.games!.map((g) => g.id)).toEqual(['vs']);
    expect((vs.bullets ?? []).some((b) => b.strong === 'Bots')).toBe(true);
  });
  it('current names and rules: Puzzles not "More Games", Sweep + Puzzles Sweep, 13+', () => {
    const all = JSON.stringify(HOW_TO_PLAY);
    expect(all).not.toMatch(/More Games/);
    expect(all).toMatch(/Puzzles Sweep/);
    expect(all).toMatch(/13 and older/);
    expect(section('Sweeps, Streaks & XP').bullets!.some((b) => b.strong === 'Streak Shields:')).toBe(true);
  });
});
