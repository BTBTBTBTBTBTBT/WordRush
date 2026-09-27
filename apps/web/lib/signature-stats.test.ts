import { describe, it, expect } from 'vitest';
import { computeSignature, computeStandingTrend } from './signature-stats';

describe('signature stats', () => {
  it('best day, best week, comebacks and perfects', () => {
    const rows = [
      { day: '2026-09-21', gameMode: 'DUEL', won: true, guessCount: 6 },      // Mon — comeback
      { day: '2026-09-21', gameMode: 'QUORDLE', won: true, guessCount: 4 },   // perfect (base 4)
      { day: '2026-09-22', gameMode: 'DUEL', won: true, guessCount: 1 },      // perfect
      { day: '2026-09-22', gameMode: 'DUEL_6', won: false, guessCount: 7 },
      { day: '2026-09-28', gameMode: 'DUEL', won: true, guessCount: 3 },      // next week
    ];
    const s = computeSignature(rows);
    expect(s.bestDay).toEqual({ day: '2026-09-21', wins: 2 });
    expect(s.bestWeek).toEqual({ weekStart: '2026-09-21', wins: 3 });
    expect(s.comebacks).toBe(1);
    expect(s.perfectGames).toBe(2);
  });
  it('standing trend averages the badge percentile per day and skips one-player fields', () => {
    const mine = [{ day: '2026-09-25', game_mode: 'DUEL', composite_score: 900 }, { day: '2026-09-25', game_mode: 'QUORDLE', composite_score: 500 }, { day: '2026-09-26', game_mode: 'DUEL', composite_score: 100 }];
    const field = [
      ...mine,
      { day: '2026-09-25', game_mode: 'DUEL', composite_score: 950 }, { day: '2026-09-25', game_mode: 'DUEL', composite_score: 800 }, { day: '2026-09-25', game_mode: 'DUEL', composite_score: 700 },
      { day: '2026-09-25', game_mode: 'QUORDLE', composite_score: 400 },
    ];
    const t = computeStandingTrend(mine, field);
    // DUEL: 1 better of 4 → Top 25%; QUORDLE: 0 better of 2 → Top 1%; avg 13. 09-26 has a field of one → skipped.
    expect(t).toEqual([{ day: '2026-09-25', topPercent: 13, modes: 2 }]);
  });
});
