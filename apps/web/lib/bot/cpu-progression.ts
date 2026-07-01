/**
 * Client-side progression for CPU practice (the "fun/addictive layer").
 *
 * Persisted per-device in localStorage — deliberately NOT in the DB: CPU play
 * is unranked practice, and these are lightweight bragging-rights numbers. W/L
 * totals still live in user_stats(vs_cpu); this only tracks the streak, the
 * boss-ladder rung, unlocked cosmetics, and the Bot-of-the-Day streak. (Can be
 * promoted to a profiles.cpu_meta jsonb later for cross-device sync.)
 */
import type { BotTier } from './bot-personas';

const KEY = 'wd_cpu_progression_v1';

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
}

const DEFAULT: CpuProgression = {
  streak: 0,
  bestStreak: 0,
  rung: 0,
  unlocked: [],
  botOfDayStreak: 0,
  botOfDayLastDay: null,
};

export function loadCpuProgression(): CpuProgression {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
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
    if (tier === 'hard' && !p.unlocked.includes(personaId)) {
      p.unlocked = [...p.unlocked, personaId];
      unlockedPersona = personaId;
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

const RUNG_NAMES = ['Unranked', 'Easy', 'Medium', 'Hard', 'Champion'];
export function rungName(rung: number): string {
  return RUNG_NAMES[Math.max(0, Math.min(RUNG_NAMES.length - 1, rung))];
}
