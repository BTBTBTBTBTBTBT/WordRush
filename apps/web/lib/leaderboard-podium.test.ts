import { describe, expect, it } from 'vitest';
import { PODIUM_STEP_HEIGHT, podiumColumn, podiumTone, rowBadge, solvedLine, splitPodium, type Ranked } from './leaderboard-podium';

const rows = (...ranks: number[]): Ranked<string>[] => ranks.map((rank, i) => ({ entry: `p${i}`, rank }));

describe('splitPodium', () => {
  it('puts the first three on the podium and the rest below', () => {
    const { podium, rest } = splitPodium(rows(1, 2, 3, 4, 5));
    expect(podium.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rest.map((r) => r.rank)).toEqual([4, 5]);
  });

  it('keeps tied ranks on the podium (competition ranking)', () => {
    expect(splitPodium(rows(1, 1, 3, 4)).podium.map((r) => r.rank)).toEqual([1, 1, 3]);
    // A three-way tie for 2nd: two take the podium, the third lists below at its real rank.
    const { podium, rest } = splitPodium(rows(1, 2, 2, 2, 5));
    expect(podium.map((r) => r.rank)).toEqual([1, 2, 2]);
    expect(rest.map((r) => r.rank)).toEqual([2, 5]);
  });

  it('never lifts a rank past 3 onto a step when a hidden row leaves a hole', () => {
    // Rank 2 blocked → the visible board is 1, 3, 4.
    expect(splitPodium(rows(1, 3, 4)).podium.map((r) => r.rank)).toEqual([1, 3]);
    // Ranks 1–3 all hidden → no podium at all.
    const { podium, rest } = splitPodium(rows(4, 5));
    expect(podium).toEqual([]);
    expect(rest.map((r) => r.rank)).toEqual([4, 5]);
  });

  it('handles short and empty boards', () => {
    expect(splitPodium(rows(1)).podium).toHaveLength(1);
    expect(splitPodium(rows(1, 2)).rest).toEqual([]);
    expect(splitPodium([])).toEqual({ podium: [], rest: [] });
  });
});

describe('podiumColumn / podiumTone', () => {
  it('stands 1st in the middle, 2nd left, 3rd right', () => {
    expect([0, 1, 2].map(podiumColumn)).toEqual([2, 1, 3]);
  });

  it('gives ties the same metal and the steps their heights', () => {
    expect([1, 1, 3].map(podiumTone)).toEqual(['gold', 'gold', 'bronze']);
    expect(podiumTone(2)).toBe('silver');
    expect(PODIUM_STEP_HEIGHT.gold).toBeGreaterThan(PODIUM_STEP_HEIGHT.silver);
    expect(PODIUM_STEP_HEIGHT.silver).toBeGreaterThan(PODIUM_STEP_HEIGHT.bronze);
  });
});

describe('rowBadge (C2a column)', () => {
  it('solo rows always carry W or L', () => {
    expect(rowBadge({ completed: true })).toBe('won');
    expect(rowBadge({ completed: false })).toBe('lost');
    expect(rowBadge({ completed: false }, 'solo')).toBe('lost');
  });
  it('VS rows keep the column empty', () => {
    expect(rowBadge({ completed: true }, 'vs')).toBeNull();
  });
});

describe('solvedLine', () => {
  it('reads a guess game as "Solved in N guesses · time"', () => {
    expect(solvedLine('guesses', 1, 4, 48, true)).toBe('Solved in 4 guesses · 48s');
    expect(solvedLine('guesses', 1, 1, 125, true)).toBe('Solved in 1 guess · 2m 5s');
  });
  it('uses the mode’s own words elsewhere', () => {
    expect(solvedLine('mistakes', 1, 1, 60, true)).toBe('Solved · 0 mistakes · 1m');
    expect(solvedLine('overPar', 1, 1, 30, true)).toBe('Solved · Par · 30s');
    expect(solvedLine('rank', 1, 4, 180, true)).toBe('Hubbub · 3m');
  });
  it('says so when the puzzle was missed', () => {
    expect(solvedLine('guesses', 1, 6, 160, false)).toBe('Not solved · 6 guesses · 2m 40s');
  });
});
