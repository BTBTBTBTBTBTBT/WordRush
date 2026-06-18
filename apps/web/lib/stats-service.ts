import { toast } from '@/hooks/use-toast';
import { supabase } from './supabase-client';
import { handleSupabaseError } from './supabase-error-handler';
import { isDailySeed, getDailySeedDate, type GauntletStageConfig, type GauntletStageResult } from '@wordle-duel/core';
import {
  recordDailyResult,
  recordDailyVsResult,
  checkAndUpdateRecord,
  awardDailyBonusesIfComplete,
  getTodayLocal,
  getYesterdayLocal,
  toLocalDayString,
} from './daily-service';
import { checkAchievements } from './achievement-service';
import { grantFreeShield } from './shield-service';

export interface XpResult {
  xpGain: number;
  streakBonus: number;
  dailyBonus: number;
  totalXp: number;
  newLevel: number;
  leveledUp: boolean;
  /** +200 XP the first time the user completes all 7 dailies today. */
  sweepBonus?: number;
  /** +400 XP additional if every one of those 7 was a win. */
  flawlessBonus?: number;
}

// ============================================================
// Pending-record retry (tab-close / network-loss protection)
// ============================================================
//
// A finished game can be silently lost when the tab closes right after the
// last guess: the terminal board snapshot persists via beforeunload, but
// recordGameResult/recordSoloMatch are plain async fetches — on reload the
// snapshot restores isCompleted=true and the recording effects never refire.
// To close that gap, each solo record call writes a compact arg payload to
// localStorage BEFORE touching the network and marks its part done on
// success; the key is removed once every registered part is done.
// drainPendingRecords() re-runs leftovers on the next signed-in visit,
// after first checking the server for an existing `matches` row so a
// payload whose network calls DID land (but whose clear didn't) can never
// double-increment user_stats / XP.

const PENDING_RECORD_PREFIX = 'wordocious-pending-record-';
const PENDING_RECORD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingGameResultArgs {
  won: boolean;
  guessCount: number;
  timeMs: number;
  boardsSolved?: number;
  totalBoards?: number;
  hintsUsed: number;
}

interface PendingSoloMatchArgs {
  won: boolean;
  score: number;
  timeSeconds: number;
  solutions: string[];
  guesses: string[];
  startedAtIso: string;
  hintsUsed?: number;
}

interface PendingRecordPayload {
  userId: string;
  gameMode: string;
  seed: string;
  savedAt: number;
  gameResult?: PendingGameResultArgs;
  gameResultDone?: boolean;
  soloMatch?: PendingSoloMatchArgs;
  soloMatchDone?: boolean;
}

function pendingRecordKey(gameMode: string, seed: string): string {
  return `${PENDING_RECORD_PREFIX}${gameMode}-${seed}`;
}

function readPendingRecord(key: string): PendingRecordPayload | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PendingRecordPayload) : null;
  } catch {
    return null;
  }
}

/** Merge a patch into the pending payload for this game (creating it if absent). */
function mergePendingRecord(
  userId: string,
  gameMode: string,
  seed: string,
  patch: Partial<PendingRecordPayload>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingRecordKey(gameMode, seed);
    const existing = readPendingRecord(key);
    const next: PendingRecordPayload = {
      ...existing,
      userId,
      gameMode,
      seed,
      savedAt: existing?.savedAt ?? Date.now(),
      ...patch,
    };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

/** Mark one half of the pending payload complete; remove the key when all registered parts are done. */
function markPendingRecordDone(gameMode: string, seed: string, part: 'gameResult' | 'soloMatch'): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingRecordKey(gameMode, seed);
    const p = readPendingRecord(key);
    if (!p) return;
    if (part === 'gameResult') p.gameResultDone = true;
    else p.soloMatchDone = true;
    const allDone = (!p.gameResult || p.gameResultDone) && (!p.soloMatch || p.soloMatchDone);
    if (allDone) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}

/**
 * Re-fire any solo game results whose record calls were cut off (tab close
 * mid-flight, network drop at the final guess). Call once after auth
 * hydration. Idempotent: a pending key whose `matches` row already exists
 * on the server is cleared without re-running anything.
 */
export async function drainPendingRecords(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PENDING_RECORD_PREFIX)) keys.push(k);
    }
  } catch {
    return;
  }

  for (const key of keys) {
    const p = readPendingRecord(key);
    if (!p || !p.userId || !p.gameMode || !p.seed) {
      try { localStorage.removeItem(key); } catch {}
      continue;
    }
    // Too stale to be meaningful — drop regardless of owner.
    if (Date.now() - (p.savedAt || 0) > PENDING_RECORD_MAX_AGE_MS) {
      try { localStorage.removeItem(key); } catch {}
      continue;
    }
    // Another account's pending result — leave it for that account's next session.
    if (p.userId !== userId) continue;

    try {
      // A matches row for this seed+mode means the original calls (or a
      // prior drain) landed — just clear, never re-run, so user_stats and
      // XP can't double-increment.
      const { data: existing, error } = await (supabase as any)
        .from('matches')
        .select('id')
        .eq('player1_id', userId)
        .eq('seed', p.seed)
        .eq('game_mode', p.gameMode)
        .limit(1)
        .maybeSingle();
      if (error) continue; // can't verify (offline?) — retry on a later drain
      if (existing) {
        try { localStorage.removeItem(key); } catch {}
        continue;
      }
    } catch {
      continue;
    }

    // Re-run the missing parts. Both functions re-register against the
    // same pending key and clear it themselves on success, so a failure
    // here simply leaves the payload in place for the next drain.
    if (p.gameResult && !p.gameResultDone) {
      await recordGameResult(
        userId, p.gameMode, 'solo', p.gameResult.won, p.gameResult.guessCount,
        p.gameResult.timeMs, p.seed, p.gameResult.boardsSolved,
        p.gameResult.totalBoards, p.gameResult.hintsUsed ?? 0,
      );
    }
    if (p.soloMatch && !p.soloMatchDone) {
      await recordSoloMatch({
        userId,
        gameMode: p.gameMode,
        seed: p.seed,
        won: p.soloMatch.won,
        score: p.soloMatch.score,
        timeSeconds: p.soloMatch.timeSeconds,
        solutions: p.soloMatch.solutions,
        guesses: p.soloMatch.guesses,
        startedAtIso: p.soloMatch.startedAtIso,
        hintsUsed: p.soloMatch.hintsUsed,
      });
    }
  }
}

/**
 * Record a game result (solo or VS) — upserts user_stats and updates profile.
 * If the seed is a daily seed, also records daily results and checks all-time records.
 * Returns XP details for post-game display.
 */
export async function recordGameResult(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  won: boolean,
  guessCount: number,
  timeMs: number,
  seed?: string,
  boardsSolved?: number,
  totalBoards?: number,
  hintsUsed: number = 0,
): Promise<XpResult | null> {
  const timeSeconds = Math.round(timeMs / 1000);

  // Crash-protection: persist the args locally BEFORE any network call so a
  // tab closed mid-flight can re-run this via drainPendingRecords(). Solo
  // only — VS results are recorded server-coordinated and must not retry.
  const trackPending = playType === 'solo' && !!seed && typeof window !== 'undefined';
  if (trackPending) {
    mergePendingRecord(userId, gameMode, seed!, {
      gameResult: { won, guessCount, timeMs, boardsSolved, totalBoards, hintsUsed },
      gameResultDone: false,
    });
  }

  try {
  // Fetch existing stats for this mode+playType
  const { data: existing } = await (supabase as any)
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .maybeSingle() as { data: any };

  if (existing) {
    const newTotalGames = existing.total_games + 1;
    const newAvgTime = existing.average_time > 0
      ? Math.round((existing.average_time * existing.total_games + timeSeconds) / newTotalGames)
      : timeSeconds;

    // supabase-js resolves (never throws) on failure — check the error so an
    // offline/rejected write aborts to the catch and the pending payload
    // survives for drainPendingRecords.
    const { error: statsError } = await (supabase as any)
      .from('user_stats')
      .update({
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        total_games: newTotalGames,
        best_score: guessCount > 0 && (existing.best_score === 0 || guessCount < existing.best_score)
          ? guessCount
          : existing.best_score,
        average_time: newAvgTime,
        fastest_time: timeSeconds > 0 && (existing.fastest_time === 0 || timeSeconds < existing.fastest_time)
          ? timeSeconds
          : existing.fastest_time,
      })
      .eq('id', existing.id);
    if (statsError) throw statsError;
  } else {
    const { error: statsError } = await (supabase as any)
      .from('user_stats')
      .insert({
        user_id: userId,
        game_mode: gameMode,
        play_type: playType,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        total_games: 1,
        best_score: guessCount,
        average_time: timeSeconds,
        fastest_time: timeSeconds,
      });
    if (statsError) throw statsError;
  }

  // Update profile totals + daily login streak in a single fetch/update
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('total_wins, total_losses, current_streak, best_streak, xp, level, last_played_at, daily_login_streak, best_daily_login_streak')
    .eq('id', userId)
    .single() as { data: any };

  if (profile) {
    // --- Win streak (resets on loss) ---
    const newWinStreak = won ? profile.current_streak + 1 : 0;
    const newBestWinStreak = Math.max(profile.best_streak, newWinStreak);

    // --- XP ---
    const xpGain = won ? 100 : 25;
    const streakBonus = won && newWinStreak > 1 ? 50 : 0;
    const isDailyGame = seed ? isDailySeed(seed) : false;
    const dailyBonus = isDailyGame ? 50 : 0;
    const totalXpGain = xpGain + streakBonus + dailyBonus;
    const newXp = profile.xp + totalXpGain;
    const oldLevel = profile.level || Math.floor(profile.xp / 1000) + 1;
    const newLevel = Math.floor(newXp / 1000) + 1;

    // --- Daily login streak (consecutive days played, player-local) ---
    const now = new Date();
    const lastPlayed = profile.last_played_at ? new Date(profile.last_played_at) : null;
    let newDailyStreak = profile.daily_login_streak || 0;

    if (lastPlayed) {
      const lastDay = toLocalDayString(lastPlayed);
      const today = getTodayLocal();
      const yesterday = getYesterdayLocal();

      if (lastDay === today) {
        // Same local day — no change to daily streak
      } else if (lastDay === yesterday) {
        newDailyStreak += 1;
        // Every 7 consecutive days grant a free streak shield. No coin
        // bonus — the coin economy was removed; shields are the sole
        // streak-milestone reward.
        if (newDailyStreak % 7 === 0) {
          grantFreeShield(userId).catch(() => {});
        }
      } else {
        // Missed a day — reset to 1 (today counts)
        newDailyStreak = 1;
      }
    } else {
      newDailyStreak = 1;
    }

    const newBestDailyStreak = Math.max(profile.best_daily_login_streak || 0, newDailyStreak);

    await (supabase as any)
      .from('profiles')
      .update({
        total_wins: profile.total_wins + (won ? 1 : 0),
        total_losses: profile.total_losses + (won ? 0 : 1),
        current_streak: newWinStreak,
        best_streak: newBestWinStreak,
        xp: newXp,
        level: newLevel,
        last_played_at: now.toISOString(),
        daily_login_streak: newDailyStreak,
        best_daily_login_streak: newBestDailyStreak,
      })
      .eq('id', userId);
  }

  // --- Daily result recording ---
  let sweepResult: Awaited<ReturnType<typeof awardDailyBonusesIfComplete>> = null;
  if (playType === 'vs') {
    // EVERY completed VS match counts toward today's Records (not just
    // daily-seed matches) — recordDailyVsResult accumulates wins/losses
    // idempotently into a single play_type='vs' row per day+mode.
    await recordDailyVsResult(userId, gameMode, won);
  } else if (seed && isDailySeed(seed)) {
    const boards = boardsSolved ?? (won ? (totalBoards ?? 1) : 0);
    const total = totalBoards ?? 1;

    const dailyScore = await recordDailyResult(
      userId, gameMode, playType, won, guessCount, timeSeconds, boards, total, hintsUsed,
      // Day comes from the SEED, not the wall clock: a daily started 23:58
      // and finished 00:02 must land on the day its puzzle was issued for.
      getDailySeedDate(seed) ?? undefined,
    );
    // Notify the DailyCompletionsProvider so the sweep banner updates
    // instantly when navigating back to the home screen.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daily-completion', {
        detail: { gameMode, won, guesses: guessCount, timeSeconds, score: Math.round(dailyScore ?? 0) },
      }));
    }
    // After the solo daily row lands, see whether this was the 7th
    // of the day and award the one-shot Daily Sweep / Flawless
    // Victory bonuses if so. Awaited so the XpResult below can carry
    // the new XP into the XpToast in a single render.
    sweepResult = await awardDailyBonusesIfComplete(userId);
  }

  // --- All-time record checks ---
  if (won && timeSeconds > 0) {
    checkAndUpdateRecord('fastest_win', gameMode, playType, userId, timeSeconds, false).catch(() => {});
  }
  if (won && guessCount > 0) {
    checkAndUpdateRecord('fewest_guesses', gameMode, playType, userId, guessCount, false).catch(() => {});
  }

  // Most games played (per mode) — fetch current total_games from user_stats
  try {
    const { data: stats } = await (supabase as any)
      .from('user_stats')
      .select('total_games')
      .eq('user_id', userId)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .maybeSingle() as { data: any };
    if (stats?.total_games) {
      checkAndUpdateRecord('most_games_played', gameMode, playType, userId, stats.total_games, true).catch(() => {});
    }
  } catch {}

  // Longest win streak (global — profile best_streak)
  if (profile) {
    const newBestStreak = Math.max(profile.best_streak || 0, won ? (profile.current_streak || 0) + 1 : 0);
    if (newBestStreak > 0) {
      checkAndUpdateRecord('longest_streak', null, null, userId, newBestStreak, true).catch(() => {});
    }
  }

  // Per-mode longest win streak
  if (won) {
    fetchModeWinStreak(userId, gameMode).then(({ best }) => {
      if (best > 0) {
        checkAndUpdateRecord('longest_streak', gameMode, playType, userId, best, true).catch(() => {});
      }
    }).catch(() => {});
  }

  // Highest level (global)
  if (profile) {
    const xpForLevel = (won ? 100 : 25) + (won && (profile.current_streak || 0) > 0 ? 50 : 0) + ((seed && isDailySeed(seed)) ? 50 : 0);
    const currentLevel = Math.floor(((profile.xp || 0) + xpForLevel) / 1000) + 1;
    checkAndUpdateRecord('highest_level', null, null, userId, currentLevel, true).catch(() => {});
  }

  // Most gold medals (global)
  if (profile) {
    try {
      const { data: medalProfile } = await (supabase as any)
        .from('profiles')
        .select('gold_medals')
        .eq('id', userId)
        .single() as { data: any };
      if (medalProfile?.gold_medals > 0) {
        checkAndUpdateRecord('most_gold_medals', null, null, userId, medalProfile.gold_medals, true).catch(() => {});
      }
    } catch {}
  }

  // Most daily completions (global — count from daily_results)
  if (seed && isDailySeed(seed)) {
    try {
      const { count } = await (supabase as any)
        .from('daily_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true);
      if (count && count > 0) {
        checkAndUpdateRecord('most_daily_completions', null, null, userId, count, true).catch(() => {});
      }
    } catch {}
  }

  // Check achievements (fire-and-forget, don't block game flow)
  checkAchievements(userId, gameMode, playType, won, guessCount, timeSeconds, seed, hintsUsed).catch(() => {});

  // All critical writes above landed — release the crash-protection payload.
  if (trackPending) markPendingRecordDone(gameMode, seed!, 'gameResult');

  // Return XP details for post-game display
  if (profile) {
    const xpGain = won ? 100 : 25;
    const streakBonusVal = won && (profile.current_streak + (won ? 1 : 0)) > 1 ? 50 : 0;
    const dailyBonusVal = (seed && isDailySeed(seed)) ? 50 : 0;
    const sweepExtraXp = sweepResult?.xpBonus ?? 0;
    const sweepBonus = sweepResult?.sweepAwarded
      ? (sweepResult.flawlessAwarded ? 200 : sweepResult.xpBonus)
      : 0;
    const flawlessBonus = sweepResult?.flawlessAwarded ? 400 : 0;
    const totalXp = xpGain + streakBonusVal + dailyBonusVal + sweepExtraXp;
    return {
      xpGain,
      streakBonus: streakBonusVal,
      dailyBonus: dailyBonusVal,
      totalXp,
      newLevel: Math.floor(((profile.xp || 0) + totalXp) / 1000) + 1,
      leveledUp: Math.floor(((profile.xp || 0) + totalXp) / 1000) + 1 > (profile.level || 1),
      sweepBonus: sweepBonus > 0 ? sweepBonus : undefined,
      flawlessBonus: flawlessBonus > 0 ? flawlessBonus : undefined,
    };
  }
  return null;
  } catch (err) {
    console.error('recordGameResult failed:', err);
    handleSupabaseError(err, 'recordGameResult');
    return null;
  }
}

/**
 * Record a match entry for match history.
 */
export async function recordMatch(data: {
  gameMode: string;
  player1Id: string;
  player2Id?: string;
  winnerId?: string;
  player1Score: number;
  player2Score?: number;
  player1Time: number;
  player2Time?: number;
  seed: string;
  solutions: string[];
  player1Guesses: string[];
  player2Guesses?: string[];
  startedAt: string;
  completedAt: string;
  forfeit?: boolean;
}) {
  await (supabase as any).from('matches').insert({
    game_mode: data.gameMode,
    player1_id: data.player1Id,
    player2_id: data.player2Id || null,
    winner_id: data.winnerId || null,
    player1_score: data.player1Score,
    player2_score: data.player2Score ?? null,
    player1_time: data.player1Time,
    player2_time: data.player2Time ?? null,
    seed: data.seed,
    solutions: data.solutions,
    player1_guesses: data.player1Guesses,
    player2_guesses: data.player2Guesses ?? null,
    started_at: data.startedAt,
    completed_at: data.completedAt,
    // Only included when true so normal-match inserts never reference the column
    // (lets this ship before the migration; forfeit rows need it).
    ...(data.forfeit ? { forfeit: true } : {}),
  });
}

/**
 * Record a solo game completion as a match-history row.
 * Writes to the `matches` table with player2_id = null so it appears in the
 * profile's Recent Matches list alongside VS results.
 */
export async function recordSoloMatch(data: {
  userId: string;
  gameMode: string;
  won: boolean;
  score: number;
  timeSeconds: number;
  seed: string;
  solutions: string[];
  guesses: string[];
  startedAtIso: string;
  /**
   * Number of hint actions used during the match. Powers the Pure
   * achievement ladder (hintless wins per mode) and the per-game
   * score-breakdown penalty. Defaults to 0 for modes that don't
   * expose hints — those rows just never get queried by the Pure
   * checks.
   */
  hintsUsed?: number;
}) {
  // Crash-protection: persist the args locally BEFORE the network call so a
  // tab closed mid-flight can re-run this via drainPendingRecords().
  const trackPending = typeof window !== 'undefined';
  if (trackPending) {
    mergePendingRecord(data.userId, data.gameMode, data.seed, {
      soloMatch: {
        won: data.won,
        score: data.score,
        timeSeconds: data.timeSeconds,
        solutions: data.solutions,
        guesses: data.guesses,
        startedAtIso: data.startedAtIso,
        hintsUsed: data.hintsUsed,
      },
      soloMatchDone: false,
    });
  }

  try {
    // supabase-js resolves with { error } instead of throwing — check it so
    // a failed insert hits the catch (toast) and keeps the pending payload.
    const { error } = await (supabase as any).from('matches').insert({
      game_mode: data.gameMode,
      player1_id: data.userId,
      player2_id: null,
      winner_id: data.won ? data.userId : null,
      player1_score: data.score,
      player1_time: data.timeSeconds,
      seed: data.seed,
      solutions: data.solutions,
      player1_guesses: data.guesses,
      hints_used: data.hintsUsed ?? 0,
      started_at: data.startedAtIso,
      completed_at: new Date().toISOString(),
    });
    if (error) throw error;
    if (trackPending) markPendingRecordDone(data.gameMode, data.seed, 'soloMatch');
  } catch (err) {
    console.error('recordSoloMatch failed:', err);
    handleSupabaseError(err, 'recordSoloMatch');
    toast({ title: 'Failed to save game results', description: 'Your stats may not be recorded.', variant: 'destructive' });
  }
}

/**
 * Persist the Gauntlet per-stage breakdown onto the matches row so the results
 * screen renders identically across devices (web ↔ native). Written as a
 * SEPARATE best-effort update after recordSoloMatch's insert — if the
 * `gauntlet_stages` column isn't present yet it silently no-ops and the match
 * row is unaffected (a missing column must never break recording). Stores the
 * exact shape both clients decode: { stages, stageResults }.
 */
export async function recordGauntletStages(
  userId: string,
  seed: string,
  payload: { stages: unknown[]; stageResults: unknown[] },
): Promise<void> {
  try {
    await (supabase as any)
      .from('matches')
      .update({ gauntlet_stages: payload })
      .eq('player1_id', userId)
      .eq('game_mode', 'GAUNTLET')
      .eq('seed', seed);
  } catch {
    // Column not migrated yet — best effort; cross-device detail turns on once applied.
  }
}

export interface GauntletStagesResult {
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  won: boolean;
  totalTimeMs: number;
}

/**
 * Read the server-persisted Gauntlet per-stage breakdown for a user + seed, so
 * the results screen renders cross-device (a run played on another device). Pairs
 * with recordGauntletStages. Returns null if the column isn't migrated, the row
 * has no breakdown, or nothing is found.
 */
export async function fetchGauntletStages(userId: string, seed: string): Promise<GauntletStagesResult | null> {
  try {
    const { data } = await (supabase as any)
      .from('matches')
      .select('gauntlet_stages, player1_time, winner_id')
      .eq('player1_id', userId)
      .eq('game_mode', 'GAUNTLET')
      .eq('seed', seed)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const gs = data?.gauntlet_stages;
    if (gs?.stages && gs?.stageResults) {
      return {
        stages: gs.stages,
        stageResults: gs.stageResults,
        won: !!data.winner_id,
        totalTimeMs: (data.player1_time ?? 0) * 1000,
      };
    }
  } catch {
    // Column not migrated / no row — cross-device detail simply stays unavailable.
  }
  return null;
}

/**
 * Fetch recent matches for a user.
 */
export async function fetchRecentMatches(userId: string, limit: number = 10) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit) as { data: any[] | null };

  return data || [];
}

/**
 * Fetch per-day match counts for the last N days, anchored to today's
 * UTC date. Returns an array of length `days` from oldest → newest, each
 * entry `{ day: 'YYYY-MM-DD', count: number }`. Empty days get count 0
 * so the caller can render a gapless bar chart.
 */
export async function fetchActivityByDay(userId: string, days: number = 7) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const { data } = await (supabase as any)
    .from('matches')
    .select('created_at')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .gte('created_at', since.toISOString()) as { data: Array<{ created_at: string }> | null };

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data || []) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}

/**
 * Fetch guess distribution for a user's solo wins.
 * Optionally filter to a specific game mode.
 */
export async function fetchGuessDistribution(userId: string, gameMode?: string) {
  let query = (supabase as any)
    .from('matches')
    .select('player1_score, player2_id, winner_id, player1_id, game_mode')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .not('winner_id', 'is', null);
  if (gameMode) query = query.eq('game_mode', gameMode);
  query = query.limit(2000);
  const { data } = await query as { data: Array<{ player1_score: number; player2_id: string | null; winner_id: string; player1_id: string; game_mode: string }> | null };

  // Bucket range follows the mode's real max guesses — a 7/13 OctoWord win
  // must not be clamped into "6". GAUNTLET (50 guesses) and the All view clamp
  // into a final "N+" bucket instead.
  const MAX_BUCKET: Record<string, number> = {
    DUEL: 6, RESCUE: 6, PROPERNOUNDLE: 6, DUEL_6: 7, DUEL_7: 8,
    QUORDLE: 9, SEQUENCE: 10, OCTORDLE: 13, GAUNTLET: 13,
  };
  const maxBucket = gameMode ? (MAX_BUCKET[gameMode] ?? 6) : 6;
  const clampable = !gameMode || gameMode === 'GAUNTLET';

  const dist: Record<number, number> = {};
  for (let g = 1; g <= maxBucket; g++) dist[g] = 0;
  for (const row of data || []) {
    const isP1 = row.player1_id === userId;
    const won = row.winner_id === userId;
    if (!won) continue;
    const score = isP1 ? row.player1_score : 0;
    if (score <= 0) continue;
    const bucket = Math.min(score, maxBucket);
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  return Object.entries(dist).map(([g, c]) => ({
    guesses: Number(g),
    count: c,
    label: `${g}${clampable && Number(g) === maxBucket ? '+' : ''}`,
  }));
}

/**
 * Fetch recent solve times for a user (wins only, solo).
 * Optionally filter to a specific game mode.
 */
export async function fetchSolveTimeHistory(userId: string, limit: number = 30, gameMode?: string) {
  let query = (supabase as any)
    .from('matches')
    .select('player1_time, player1_id, winner_id, game_mode, created_at, player2_id')
    .eq('player1_id', userId)
    .eq('winner_id', userId)
    .is('player2_id', null)
    .gt('player1_time', 0);
  if (gameMode) query = query.eq('game_mode', gameMode);
  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(limit) as { data: Array<{ player1_time: number; game_mode: string; created_at: string }> | null };

  return (data || []).reverse().map((r) => ({
    date: r.created_at.slice(0, 10),
    timeSeconds: Math.round(r.player1_time),
    mode: r.game_mode,
  }));
}

/**
 * Fetch daily calendar data: which days the user played in the last N days.
 * Returns { day: string, gamesPlayed: number, gamesWon: number }.
 */
export async function fetchDailyCalendar(userId: string, days: number = 90) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const { data } = await (supabase as any)
    .from('matches')
    .select('created_at, winner_id, player1_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .gte('created_at', since.toISOString())
    .limit(2000) as { data: Array<{ created_at: string; winner_id: string | null; player1_id: string }> | null };

  const buckets = new Map<string, { gamesPlayed: number; gamesWon: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { gamesPlayed: 0, gamesWon: 0 });
  }
  for (const row of data || []) {
    const key = row.created_at.slice(0, 10);
    const entry = buckets.get(key);
    if (entry) {
      entry.gamesPlayed++;
      if (row.winner_id === userId) entry.gamesWon++;
    }
  }
  return Array.from(buckets.entries()).map(([day, stats]) => ({ day, ...stats }));
}

/**
 * Fetch current and best win streak for a specific game mode.
 */
export async function fetchModeWinStreak(userId: string, gameMode: string) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('winner_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('game_mode', gameMode)
    .order('created_at', { ascending: false })
    .limit(200) as { data: Array<{ winner_id: string | null }> | null };

  let current = 0;
  let best = 0;
  let streak = 0;
  let foundFirstLoss = false;
  for (const row of data || []) {
    if (row.winner_id === userId) {
      streak++;
      best = Math.max(best, streak);
      if (!foundFirstLoss) current = streak;
    } else {
      if (!foundFirstLoss) foundFirstLoss = true;
      streak = 0;
    }
  }
  return { current, best };
}

/**
 * Fetch time-of-day play pattern (24 hourly buckets).
 */
export async function fetchTimeOfDayHeatmap(userId: string, gameMode?: string) {
  let query = (supabase as any)
    .from('matches')
    .select('created_at, winner_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
  if (gameMode) query = query.eq('game_mode', gameMode);
  query = query.limit(2000);
  const { data } = await query as { data: Array<{ created_at: string; winner_id: string | null }> | null };

  const hours: Array<{ hour: number; gamesPlayed: number; gamesWon: number }> = [];
  for (let h = 0; h < 24; h++) hours.push({ hour: h, gamesPlayed: 0, gamesWon: 0 });
  for (const row of data || []) {
    const h = new Date(row.created_at).getHours();
    hours[h].gamesPlayed++;
    if (row.winner_id === userId) hours[h].gamesWon++;
  }
  return hours;
}

/**
 * Compare last 10 solo win times vs overall average for a mode.
 */
export async function fetchImprovementTrend(userId: string, gameMode: string) {
  const [recentData, statsData] = await Promise.all([
    (supabase as any)
      .from('matches')
      .select('player1_time')
      .eq('player1_id', userId)
      .eq('winner_id', userId)
      .eq('game_mode', gameMode)
      .is('player2_id', null)
      .gt('player1_time', 0)
      .order('created_at', { ascending: false })
      .limit(10),
    (supabase as any)
      .from('user_stats')
      .select('average_time')
      .eq('user_id', userId)
      .eq('game_mode', gameMode)
      .eq('play_type', 'solo')
      .maybeSingle(),
  ]);

  const times: number[] = (recentData.data || []).map((r: any) => r.player1_time);
  if (times.length === 0) return { recentAvg: 0, overallAvg: 0, percentChange: 0, improving: false };
  const recentAvg = Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length);
  const overallAvg = statsData.data?.average_time || recentAvg;
  const percentChange = overallAvg > 0 ? Math.round(((overallAvg - recentAvg) / overallAvg) * 100) : 0;
  return { recentAvg, overallAvg, percentChange, improving: recentAvg < overallAvg };
}

/**
 * Fetch personal bests (fastest win + fewest guesses) for a mode.
 */
export async function fetchPersonalBests(userId: string, gameMode: string) {
  const [fastestData, fewestData] = await Promise.all([
    (supabase as any)
      .from('matches')
      .select('player1_time, created_at')
      .eq('player1_id', userId)
      .eq('winner_id', userId)
      .eq('game_mode', gameMode)
      .is('player2_id', null)
      .gt('player1_time', 0)
      .order('player1_time', { ascending: true })
      .limit(1),
    (supabase as any)
      .from('matches')
      .select('player1_score, created_at')
      .eq('player1_id', userId)
      .eq('winner_id', userId)
      .eq('game_mode', gameMode)
      .is('player2_id', null)
      .gt('player1_score', 0)
      .order('player1_score', { ascending: true })
      .limit(1),
  ]);

  const fastest = fastestData.data?.[0];
  const fewest = fewestData.data?.[0];
  return {
    fastestWin: fastest ? { time: Math.round(fastest.player1_time), date: fastest.created_at.slice(0, 10) } : null,
    fewestGuesses: fewest ? { count: fewest.player1_score, date: fewest.created_at.slice(0, 10) } : null,
  };
}

/**
 * Count perfect games (1-guess wins) for a mode.
 */
export async function fetchPerfectGameCount(userId: string, gameMode: string) {
  const { count } = await (supabase as any)
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('player1_id', userId)
    .eq('winner_id', userId)
    .eq('game_mode', gameMode)
    .eq('player1_score', 1) as { count: number | null };
  return count || 0;
}

/**
 * Calculate consistency score (0-100) from coefficient of variation of last 20 solve times.
 */
export async function fetchConsistencyScore(userId: string, gameMode: string) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('player1_time')
    .eq('player1_id', userId)
    .eq('winner_id', userId)
    .eq('game_mode', gameMode)
    .is('player2_id', null)
    .gt('player1_time', 0)
    .order('created_at', { ascending: false })
    .limit(20) as { data: Array<{ player1_time: number }> | null };

  const times = (data || []).map((r) => r.player1_time);
  if (times.length < 3) return { score: 0, sampleSize: times.length };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 0;
  const score = Math.max(0, Math.round(100 - cv * 100));
  return { score, sampleSize: times.length };
}

/**
 * Fetch top N most-used guess words across ALL modes for a user.
 */
export async function fetchTopWordsAllTime(userId: string, limit: number = 5) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('player1_id, player1_guesses, player2_guesses, winner_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .not('player1_guesses', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000) as {
    data: Array<{ player1_id: string; player1_guesses: string[]; player2_guesses: string[] | null; winner_id: string | null }> | null;
  };

  const wordMap = new Map<string, { count: number; wins: number }>();
  for (const row of data || []) {
    const guesses = row.player1_id === userId ? row.player1_guesses : row.player2_guesses;
    if (!Array.isArray(guesses)) continue;
    const won = row.winner_id === userId;
    for (const word of guesses) {
      const w = word.toUpperCase();
      const entry = wordMap.get(w) || { count: 0, wins: 0 };
      entry.count++;
      if (won) entry.wins++;
      wordMap.set(w, entry);
    }
  }

  return Array.from(wordMap.entries())
    .map(([word, stats]) => ({ word, count: stats.count, wins: stats.wins }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Fetch top N most-used guess words for a user in a specific mode.
 * Counts frequency from `player1_guesses` — shows the user's go-to words.
 */
export async function fetchTopWords(userId: string, gameMode: string, limit: number = 5) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('player1_guesses, winner_id')
    .eq('player1_id', userId)
    .eq('game_mode', gameMode)
    .not('player1_guesses', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500) as { data: Array<{ player1_guesses: string[]; winner_id: string | null }> | null };

  const wordMap = new Map<string, { count: number; wins: number }>();
  for (const row of data || []) {
    if (!Array.isArray(row.player1_guesses)) continue;
    const won = row.winner_id === userId;
    for (const word of row.player1_guesses) {
      const w = word.toUpperCase();
      const entry = wordMap.get(w) || { count: 0, wins: 0 };
      entry.count++;
      if (won) entry.wins++;
      wordMap.set(w, entry);
    }
  }

  return Array.from(wordMap.entries())
    .map(([word, stats]) => ({ word, count: stats.count, wins: stats.wins }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Fetch word-based insights: nemesis word (most losses), lucky word (fastest solve).
 */
export async function fetchWordInsights(userId: string, gameMode: string) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('solutions, winner_id, player1_time, player1_score')
    .eq('player1_id', userId)
    .eq('game_mode', gameMode)
    .not('solutions', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500) as { data: Array<{ solutions: string[]; winner_id: string | null; player1_time: number; player1_score: number }> | null };

  const lossMap = new Map<string, number>();
  const speedMap = new Map<string, { bestTime: number; guesses: number }>();
  let totalGuesses = 0;
  let totalWins = 0;
  let firstTryWins = 0;

  for (const row of data || []) {
    if (!Array.isArray(row.solutions)) continue;
    const won = row.winner_id === userId;
    if (won) {
      totalWins++;
      if (row.player1_score === 1) firstTryWins++;
      totalGuesses += row.player1_score || 0;
      for (const word of row.solutions) {
        const w = word.toUpperCase();
        const existing = speedMap.get(w);
        if (!existing || (row.player1_time > 0 && row.player1_time < existing.bestTime)) {
          speedMap.set(w, { bestTime: row.player1_time, guesses: row.player1_score });
        }
      }
    } else {
      for (const word of row.solutions) {
        const w = word.toUpperCase();
        lossMap.set(w, (lossMap.get(w) || 0) + 1);
      }
    }
  }

  let nemesis: { word: string; losses: number } | null = null;
  let maxLosses = 0;
  for (const [word, losses] of lossMap) {
    if (losses > maxLosses) {
      maxLosses = losses;
      nemesis = { word, losses };
    }
  }

  let luckyWord: { word: string; time: number } | null = null;
  let bestTime = Infinity;
  for (const [word, stats] of speedMap) {
    if (stats.bestTime > 0 && stats.bestTime < bestTime) {
      bestTime = stats.bestTime;
      luckyWord = { word, time: stats.bestTime };
    }
  }

  return {
    nemesis,
    luckyWord,
    avgGuesses: totalWins > 0 ? Math.round((totalGuesses / totalWins) * 10) / 10 : 0,
    firstTryRate: totalWins > 0 ? Math.round((firstTryWins / totalWins) * 100) : 0,
  };
}

/**
 * Fetch VS head-to-head record for a game mode.
 */
export async function fetchHeadToHeadRecord(userId: string, gameMode: string) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('winner_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('game_mode', gameMode)
    .not('player2_id', 'is', null)
    .limit(1000) as { data: Array<{ winner_id: string | null }> | null };

  let wins = 0;
  let losses = 0;
  for (const row of data || []) {
    if (row.winner_id === userId) wins++;
    else if (row.winner_id) losses++;
  }
  const total = wins + losses;
  return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
}

// ── Daily Sweep / Flawless Victory stats (profile "All" view) ──────────────
// Source of truth: daily_bonuses (sweep/flawless flags per day) ⨝ daily_results
// (per-mode time + composite_score per day). All aggregation is client-side.

export interface DailySweepStats {
  sweepCount: number;
  flawlessCount: number;
  avgSweepSecs: number;
  avgFlawlessSecs: number;
  bestSweepSecs: number;
  bestFlawlessSecs: number;
  currentSweepStreak: number;
}

export interface DailyPointsPoint {
  day: string;
  totalPoints: number;
  swept: boolean;
  flawless: boolean;
}

/** Add/subtract days from a YYYY-MM-DD local-day string. */
function dayShift(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export async function fetchDailySweepStats(userId: string): Promise<DailySweepStats> {
  const empty: DailySweepStats = {
    sweepCount: 0, flawlessCount: 0, avgSweepSecs: 0, avgFlawlessSecs: 0,
    bestSweepSecs: 0, bestFlawlessSecs: 0, currentSweepStreak: 0,
  };

  const { data: bonuses } = await (supabase as any)
    .from('daily_bonuses')
    .select('day, sweep_awarded, flawless_awarded')
    .eq('user_id', userId) as {
    data: Array<{ day: string; sweep_awarded: boolean; flawless_awarded: boolean }> | null;
  };
  if (!bonuses || bonuses.length === 0) return empty;

  const sweepDays = bonuses.filter((b) => b.sweep_awarded).map((b) => b.day);
  const flawlessDays = new Set(bonuses.filter((b) => b.flawless_awarded).map((b) => b.day));
  if (sweepDays.length === 0) return empty;

  // Per-day total solo time across that day's daily modes.
  const { data: rows } = await (supabase as any)
    .from('daily_results')
    .select('day, time_seconds')
    .eq('user_id', userId)
    .eq('play_type', 'solo')
    .in('day', sweepDays) as { data: Array<{ day: string; time_seconds: number }> | null };

  const perDayTime = new Map<string, number>();
  for (const r of rows || []) perDayTime.set(r.day, (perDayTime.get(r.day) ?? 0) + (r.time_seconds ?? 0));

  const sweepTimes = sweepDays.map((d) => perDayTime.get(d) ?? 0).filter((t) => t > 0);
  const flawlessTimes = [...flawlessDays].map((d) => perDayTime.get(d) ?? 0).filter((t) => t > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0);

  // Current consecutive-sweep streak ending today or yesterday.
  const sweepSet = new Set(sweepDays);
  const today = getTodayLocal();
  let cursor: string | null = sweepSet.has(today)
    ? today
    : (sweepSet.has(dayShift(today, -1)) ? dayShift(today, -1) : null);
  let streak = 0;
  while (cursor && sweepSet.has(cursor)) { streak += 1; cursor = dayShift(cursor, -1); }

  return {
    sweepCount: sweepDays.length,
    flawlessCount: flawlessDays.size,
    avgSweepSecs: avg(sweepTimes),
    avgFlawlessSecs: avg(flawlessTimes),
    bestSweepSecs: min(sweepTimes),
    bestFlawlessSecs: min(flawlessTimes),
    currentSweepStreak: streak,
  };
}

export async function fetchDailyPointsOverTime(userId: string, days = 30): Promise<DailyPointsPoint[]> {
  const cutoff = dayShift(getTodayLocal(), -(days - 1));
  const { data: rows } = await (supabase as any)
    .from('daily_results')
    .select('day, composite_score, completed')
    .eq('user_id', userId)
    .eq('play_type', 'solo')
    .gte('day', cutoff) as {
    data: Array<{ day: string; composite_score: number; completed: boolean }> | null;
  };
  if (!rows || rows.length === 0) return [];

  const { data: bonuses } = await (supabase as any)
    .from('daily_bonuses')
    .select('day, sweep_awarded, flawless_awarded')
    .eq('user_id', userId)
    .gte('day', cutoff) as {
    data: Array<{ day: string; sweep_awarded: boolean; flawless_awarded: boolean }> | null;
  };
  const sweptSet = new Set((bonuses || []).filter((b) => b.sweep_awarded).map((b) => b.day));
  const flawlessSet = new Set((bonuses || []).filter((b) => b.flawless_awarded).map((b) => b.day));

  const perDay = new Map<string, number>();
  for (const r of rows) perDay.set(r.day, (perDay.get(r.day) ?? 0) + Math.round(r.composite_score ?? 0));

  return [...perDay.entries()]
    .map(([day, totalPoints]) => ({ day, totalPoints, swept: sweptSet.has(day), flawless: flawlessSet.has(day) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
