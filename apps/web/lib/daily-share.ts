'use client';

// Builds the "all dailies" share card (Daily Sweep / Flawless Victory) from
// today's daily completions and fires the shared share flow. The card lists
// every daily mode in canonical order with its accent badge + per-game stats
// and the summed totals — keep this list identical to iOS/Android so the three
// share cards match exactly.

import { shareResult } from '@/lib/share-utils';
import type { ShareDailyGame, ShareDailySweepInput, ShareMode } from '@/lib/share-image';
import type { DailyCompletion } from '@/lib/daily-service';
import { computeDailyTotals } from '@/lib/daily-service';
import { DAILY_MODES, MORE_GAME_MODES } from '@/lib/modes.generated';
import { computeMoreTotals, moreSweepTier } from '@/lib/more-games';

/** DB game_mode → share mode + display label, from the single-source catalog. */
const DAILY_SHARE_MODES: Array<{ dbKey: string; mode: ShareMode; label: string }> =
  DAILY_MODES.map((m) => ({ dbKey: m.dbKey as string, mode: m.title as ShareMode, label: m.shareLabel }));

/** Map today's completions into the share-card input. */
export function buildDailySweepInput(
  completions: Map<string, DailyCompletion>,
): ShareDailySweepInput {
  const totals = computeDailyTotals(completions);
  const games: ShareDailyGame[] = DAILY_SHARE_MODES.flatMap(({ dbKey, mode, label }) => {
    const c = completions.get(dbKey);
    if (!c) return [];
    return [{
      mode,
      modeLabel: label,
      won: c.won,
      guesses: c.guesses,
      timeSeconds: c.timeSeconds,
      score: c.score,
    }];
  });
  return {
    layout: 'daily-sweep',
    mode: 'Classic',
    flawless: totals.flawless,
    games,
    total: totals.total,
    won: totals.won,
    totalGuesses: totals.totalGuesses,
    totalTimeSeconds: totals.totalTimeSeconds,
    totalScore: totals.totalScore,
  };
}

/**
 * More Games Sweep / Flawless share (founder, 2026-09-26): the same tile card,
 * headed "MORE GAMES SWEEP" / "FLAWLESS MORE GAMES", over the ten More Games
 * dailies only. Nothing here touches the Daily Sweep card above.
 */
export function buildMoreSweepInput(
  completions: Map<string, DailyCompletion>,
): ShareDailySweepInput {
  const totals = computeMoreTotals(completions);
  const tier = moreSweepTier(completions);
  const games: ShareDailyGame[] = MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey).flatMap((m) => {
    const c = completions.get(m.dbKey as string);
    if (!c) return [];
    return [{ mode: m.title as ShareMode, modeLabel: m.shareLabel, won: c.won, guesses: c.guesses, timeSeconds: c.timeSeconds, score: c.score }];
  });
  return {
    layout: 'daily-sweep',
    mode: 'Classic',
    title: tier === 'flawless' ? 'FLAWLESS MORE GAMES' : 'MORE GAMES SWEEP',
    flawless: tier === 'flawless',
    games,
    total: totals.total,
    won: totals.won,
    totalGuesses: games.reduce((n, g) => n + g.guesses, 0),
    totalTimeSeconds: totals.totalTimeSeconds,
    totalScore: totals.totalScore,
  };
}

export async function shareMoreSweep(completions: Map<string, DailyCompletion>) {
  return shareResult(buildMoreSweepInput(completions));
}

/** Generate + share the all-dailies card. */
export async function shareDailySweep(completions: Map<string, DailyCompletion>) {
  return shareResult(buildDailySweepInput(completions));
}
