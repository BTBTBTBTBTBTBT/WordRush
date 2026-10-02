/**
 * Client-side progression for CPU practice (the "fun/addictive layer").
 *
 * Persisted per-device in localStorage — deliberately NOT in the DB: CPU play
 * is unranked practice, and these are lightweight bragging-rights numbers. W/L
 * totals still live in user_stats(vs_cpu); this only tracks the streak, the
 * boss-ladder rung, unlocked cosmetics, and the Bot-of-the-Day streak. (Can be
 * promoted to a profiles.cpu_meta jsonb later for cross-device sync.)
 */
import { canonicalBotId, ladderAfterGame, migrateLegacyLadderCleared } from '@wordle-duel/core';
import type { BotTier } from './bot-personas';

const KEY = 'wd_cpu_progression_v1';
/** The cast ladder's save version (see CpuProgression.ladderVersion). */
export const LADDER_VERSION = 2;

export interface CpuProgression {
  /** Current consecutive CPU wins (any tier). Resets on a loss. */
  streak: number;
  /** Best CPU win streak ever. */
  bestStreak: number;
  /** Highest ladder rung reached: 0 none, 1 easy, 2 medium, 3 hard, 4 champion. */
  rung: number;
  /** Persona ids unlocked as cosmetics (beaten on Hard). */
  unlocked: string[];
  /** Bot-of-the-Day: current day-streak + the last day it was beaten (UTC yyyy-mm-dd). */
  botOfDayStreak: number;
  botOfDayLastDay: string | null;
  /** The bot ladder (core ladderAfterGame): rungs cleared 0–10 (the cast ladder, FINISH_SPEC D1). */
  ladderCleared: number;
  /**
   * 2 = the ten-bot cast ladder. Missing (older saves) = the old four-rung
   * ladder, migrated on load: cleared N → [0, 2, 4, 7, 10][N], run reset.
   */
  ladderVersion?: number;
  /** Wins in a row against the next ladder bot. */
  ladderRun: number;
  /** UTC day the Bot of the Day was last played, and how it went. */
  botOfDayPlayedDay: string | null;
  botOfDayResult: 'won' | 'lost' | 'draw' | null;
}

const DEFAULT: CpuProgression = {
  streak: 0,
  bestStreak: 0,
  rung: 0,
  unlocked: [],
  botOfDayStreak: 0,
  botOfDayLastDay: null,
  ladderCleared: 0,
  ladderRun: 0,
  ladderVersion: LADDER_VERSION,
  botOfDayPlayedDay: null,
  botOfDayResult: null,
};

/** A fresh progression (what a new device starts with). */
export function emptyCpuProgression(): CpuProgression {
  return { ...DEFAULT, unlocked: [] };
}

/**
 * A stored progression brought up to the cast ladder (FINISH_SPEC D1): an
 * old save's four-rung count maps to the ten-rung one (core
 * migrateLegacyLadderCleared) and its run restarts; old persona ids in the
 * unlocked list become their cast replacement. Pure: unit-tested.
 */
export function migrateCpuProgression(saved: Partial<CpuProgression>): CpuProgression {
  const p: CpuProgression = { ...DEFAULT, ...saved, unlocked: [...(saved.unlocked ?? [])] };
  if (saved.ladderVersion !== LADDER_VERSION) {
    p.ladderCleared = migrateLegacyLadderCleared(saved.ladderCleared ?? 0);
    p.ladderRun = 0;
    p.ladderVersion = LADDER_VERSION;
  }
  p.unlocked = Array.from(new Set(p.unlocked.map(canonicalBotId)));
  return p;
}

export function loadCpuProgression(): CpuProgression {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const p = migrateCpuProgression(JSON.parse(raw));
    if (JSON.parse(raw).ladderVersion !== LADDER_VERSION) save(p);
    return p;
  } catch {
    return { ...DEFAULT };
  }
}

function save(p: CpuProgression): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

const TIER_RUNG: Record<BotTier, number> = { easy: 1, medium: 2, hard: 3 };
const MILESTONES = [5, 10, 25, 50, 100];

export interface CpuResultOutcome {
  progression: CpuProgression;
  /** A newly-reached streak milestone (5/10/25…), else null. */
  milestone: number | null;
  /** A newly-unlocked persona id (Hard win), else null. */
  unlockedPersona: string | null;
}

/**
 * Fold a finished CPU game into progression. Call once per CPU match end.
 * `tier` is the concrete difficulty faced (adaptive maps to medium, ghost/daily
 * pass their nearest tier).
 */
export function recordCpuGame(won: boolean, tier: BotTier, personaId: string): CpuResultOutcome {
  const p = loadCpuProgression();
  let milestone: number | null = null;
  let unlockedPersona: string | null = null;

  if (won) {
    p.streak += 1;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    if (MILESTONES.includes(p.streak)) milestone = p.streak;
    // Ladder: reaching a tier's rung by beating it.
    p.rung = Math.max(p.rung, TIER_RUNG[tier]);
    // Champion rung: a Hard win while on a 3+ streak.
    if (tier === 'hard' && p.streak >= 3) p.rung = Math.max(p.rung, 4);
    // Cosmetic: beating a persona on Hard unlocks its badge.
    const castId = canonicalBotId(personaId);
    if (tier === 'hard' && !p.unlocked.includes(castId)) {
      p.unlocked = [...p.unlocked, castId];
      unlockedPersona = castId;
    }
  } else {
    p.streak = 0;
    // Drop back a rung on a loss (never below what your best tier justifies=1).
    if (p.rung > 1) p.rung -= 1;
  }

  save(p);
  return { progression: p, milestone, unlockedPersona };
}

/** Record a Bot-of-the-Day result against today's UTC date. */
export function recordBotOfDay(won: boolean, todayUtc: string): CpuProgression {
  const p = loadCpuProgression();
  if (won && p.botOfDayLastDay !== todayUtc) {
    // Continue the streak if yesterday was the last win, else reset to 1.
    const prev = new Date(todayUtc + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yesterday = prev.toISOString().slice(0, 10);
    p.botOfDayStreak = p.botOfDayLastDay === yesterday ? p.botOfDayStreak + 1 : 1;
    p.botOfDayLastDay = todayUtc;
    save(p);
  }
  return p;
}

/**
 * Fold one finished bot game into the ladder (core ladderAfterGame — only games
 * against the NEXT bot count). `botId` comes from botIdForKind; a challenge
 * race is not a bot game and never reaches here.
 */
export function foldLadder(p: CpuProgression, botId: string, won: boolean): CpuProgression {
  const next = ladderAfterGame({ cleared: p.ladderCleared, run: p.ladderRun }, botId, won);
  return { ...p, ladderCleared: next.cleared, ladderRun: next.run };
}

export function recordLadderGame(botId: string, won: boolean): CpuProgression {
  const p = foldLadder(loadCpuProgression(), botId, won);
  save(p);
  return p;
}

/** Mark today's (UTC) Bot of the Day as played, win, loss or draw (the day-streak is recordBotOfDay's). */
export function recordBotOfDayResult(result: 'won' | 'lost' | 'draw', todayUtc: string): CpuProgression {
  const p = { ...loadCpuProgression(), botOfDayPlayedDay: todayUtc, botOfDayResult: result };
  save(p);
  return p;
}

/** Today's Bot of the Day state for the VS banner: 'open' until it is played this UTC day. */
export function botOfDayToday(p: CpuProgression, todayUtc: string): 'open' | 'won' | 'lost' | 'draw' {
  return p.botOfDayPlayedDay === todayUtc && p.botOfDayResult ? p.botOfDayResult : 'open';
}

const RUNG_NAMES = ['Unranked', 'Easy', 'Medium', 'Hard', 'Champion'];
export function rungName(rung: number): string {
  return RUNG_NAMES[Math.max(0, Math.min(RUNG_NAMES.length - 1, rung))];
}
