// 2.8 items 7 + 48 (founder 10-08 / 10-09): the Home banner headline speaks to the STREAK, not just today's
// flawless — "FLAWLESS 3-PEAT!", milestone lines at 3 / 4 / 5 / 6 / 7 / 10 / 14 / 30, "NEW BEST!" on a record run,
// and a kind restart line after a break. Pure, so web, iOS and Android read the SAME words (the Swift / Kotlin ports
// assert against home-banner-fixtures.json). Copy varies by day: the variant is picked by a stable hash of the date
// key, so everyone sees the same line that day and it never repeats flatly day to day (the hash is salted with the
// streak length, and consecutive days always differ in the number). American spelling; every line fits in full
// (bubble lettering wraps — never "FLAWLES…"). The streak NUMBER is a digit in the text, so the bubble renderer
// tints it gold and pops it in when it changes.

export type StreakKind = 'flawless' | 'sweep';

export interface StreakHeadlineInput {
  kind: StreakKind;
  /** The run including today (today's group just finished). */
  days: number;
  /** The player's best run ever INCLUDING this one; 0 = unknown (no "NEW BEST!"). */
  best?: number;
  /** The local day, `YYYY-MM-DD`: picks the day's variant. */
  dateKey: string;
}

/** A stable non-negative hash (FNV-1a over the code units, 31 bits) — identical in every port. */
export function dayHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h & 0x7fffffff;
}

const N = '{n}';

/** Milestone pools (exact lengths). `{n}` = the streak. */
const FLAWLESS_MILESTONES: Readonly<Record<number, readonly string[]>> = {
  2: ['FLAWLESS · 2 IN A ROW!', 'BACK-TO-BACK FLAWLESS!', 'FLAWLESS TWICE IN A ROW!'],
  3: ['FLAWLESS 3-PEAT!', 'THREE FLAWLESS DAYS!', 'FLAWLESS · 3 IN A ROW!'],
  4: ['FOUR-MIDABLE! 4 FLAWLESS DAYS', 'A PERFECT FOUR-SOME!', 'FLAWLESS · 4 IN A ROW!'],
  5: ['HIGH FIVE! 5 FLAWLESS DAYS', 'FIVE PERFECT DAYS!', 'FLAWLESS · 5 IN A ROW!'],
  6: ['SO CLOSE TO A WEEK! 6 FLAWLESS', 'SIX FLAWLESS DAYS!', 'FLAWLESS · 6 IN A ROW!'],
  7: ['A WHOLE WEEK FLAWLESS!', 'FLAWLESS WEEK!', '7 DAYS, ZERO MISSES!'],
  10: ['TEN FLAWLESS DAYS!', 'DOUBLE DIGITS FLAWLESS!', '10 IN A ROW, ZERO MISSES!'],
  14: ['TWO FLAWLESS WEEKS!', '14 DAYS, ZERO MISSES!', 'A FORTNIGHT OF FLAWLESS!'],
  30: ['A FLAWLESS MONTH!', '30 PERFECT DAYS!', 'LEGENDARY · 30 FLAWLESS DAYS!'],
};
const SWEEP_MILESTONES: Readonly<Record<number, readonly string[]>> = {
  2: ['SWEPT · 2 DAYS IN A ROW!', 'BACK-TO-BACK SWEEPS!', 'CLEAN SWEEP, TWICE IN A ROW!'],
  3: ['SWEEP 3-PEAT!', 'THREE SWEEPS IN A ROW!', 'SWEPT · 3 DAYS RUNNING!'],
  4: ['FOUR SWEEPS RUNNING!', 'A SWEEPING FOUR-SOME!', 'SWEPT · 4 DAYS IN A ROW!'],
  5: ['HIGH FIVE! 5 SWEEPS IN A ROW', 'FIVE CLEAN SWEEPS!', 'SWEPT · 5 DAYS IN A ROW!'],
  6: ['SO CLOSE TO A WEEK! 6 SWEEPS', 'SIX SWEEPS IN A ROW!', 'SWEPT · 6 DAYS IN A ROW!'],
  7: ['A WHOLE WEEK OF SWEEPS!', 'SWEEP WEEK!', '7 DAYS, 7 SWEEPS!'],
  10: ['TEN SWEEPS IN A ROW!', 'DOUBLE DIGITS OF SWEEPS!', '10 DAYS, 10 SWEEPS!'],
  14: ['TWO WEEKS OF SWEEPS!', '14 SWEEPS IN A ROW!', 'A FORTNIGHT OF SWEEPS!'],
  30: ['A SWEEPING MONTH!', '30 SWEEPS IN A ROW!', 'LEGENDARY · 30 DAYS OF SWEEPS!'],
};

/** Every other length (8, 9, 11–13, 15–29, 31+). */
const FLAWLESS_GENERIC: readonly string[] = [`FLAWLESS · ${N} IN A ROW!`, `${N} FLAWLESS DAYS!`, `${N} PERFECT DAYS IN A ROW!`];
const SWEEP_GENERIC: readonly string[] = [`SWEPT · ${N} DAYS IN A ROW!`, `${N} SWEEPS IN A ROW!`, `${N} CLEAN SWEEPS RUNNING!`];

/** "NEW BEST!" — a record run on a day that isn't a milestone. */
const FLAWLESS_NEW_BEST: readonly string[] = [`NEW BEST! ${N} FLAWLESS DAYS`, `NEW BEST · ${N} FLAWLESS IN A ROW!`, `A NEW RECORD! ${N} FLAWLESS DAYS`];
const SWEEP_NEW_BEST: readonly string[] = [`NEW BEST! ${N} SWEEPS IN A ROW`, `NEW BEST · ${N} DAYS OF SWEEPS!`, `A NEW RECORD! ${N} SWEEPS`];

/** After a break: today is the first of a fresh run and the old run was a real one (best >= 3). */
const FLAWLESS_RESTART: readonly string[] = ['FLAWLESS AGAIN! A FRESH START', 'BACK ON TRACK! FLAWLESS TODAY', 'A NEW STREAK STARTS NOW!'];
const SWEEP_RESTART: readonly string[] = ['SWEPT AGAIN! A FRESH START', 'BACK ON TRACK! SWEPT TODAY', 'A NEW SWEEP STREAK STARTS NOW!'];

/** Milestone lengths (they win over "NEW BEST!"). */
export const STREAK_MILESTONES: readonly number[] = [2, 3, 4, 5, 6, 7, 10, 14, 30];

function pick(pool: readonly string[], seed: string, days: number): string {
  return pool[dayHash(`${seed}|${days}`) % pool.length].split(N).join(String(days));
}

/**
 * The streak headline for a group that just earned today's flawless / sweep, or null when there is no streak news
 * to tell (a first-ever day with no past run — the caller falls back to the plain "<GROUP> FLAWLESS!" line).
 */
export function streakHeadline(i: StreakHeadlineInput): string | null {
  const days = Math.max(0, Math.floor(i.days));
  const flawless = i.kind === 'flawless';
  const best = Math.max(0, Math.floor(i.best ?? 0));
  if (days <= 1) {
    // Today restarts a run after a real one broke.
    if (days === 1 && best >= 3) return pick(flawless ? FLAWLESS_RESTART : SWEEP_RESTART, i.dateKey, days);
    return null;
  }
  const milestones = flawless ? FLAWLESS_MILESTONES : SWEEP_MILESTONES;
  const milestone = milestones[days];
  if (milestone) return pick(milestone, i.dateKey, days);
  if (best > 0 && days >= best && days >= 3) return pick(flawless ? FLAWLESS_NEW_BEST : SWEEP_NEW_BEST, i.dateKey, days);
  return pick(flawless ? FLAWLESS_GENERIC : SWEEP_GENERIC, i.dateKey, days);
}
