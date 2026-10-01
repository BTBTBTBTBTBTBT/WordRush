// Home banner rules (founder-approved home redesign, 2026-10-01). One banner
// tops the home page: a frosted headline strip over two rows, Wordocious (the
// eight sweep dailies) and Puzzles (the ten More Games dailies). Each row
// glows on its own: purple when every game in it is finished (a sweep), gold
// when every game in it is won (a flawless); both gold is a Double Flawless.
//
// Everything here is pure so web, iOS and Android read the SAME words: the
// Swift and Kotlin ports assert against home-banner-fixtures.json
// (scripts/gen-parity-fixtures.ts).

export type BannerTier = 'none' | 'sweep' | 'flawless';

/** One row's progress today: how many of its `total` dailies are finished, and how many won. */
export interface GroupProgress {
  played: number;
  won: number;
  total: number;
}

/** A row glows once every game in it is finished; gold only when every one is won. */
export function groupTier(g: GroupProgress): BannerTier {
  if (g.total <= 0 || g.played < g.total) return 'none';
  return g.won >= g.total ? 'flawless' : 'sweep';
}

/** The row's status text: "3/8", "SWEEP · 7/8 WON", "FLAWLESS · 8/8 WON". */
export function groupStatus(g: GroupProgress): string {
  const tier = groupTier(g);
  if (tier === 'none') return `${g.played}/${g.total}`;
  return `${tier === 'flawless' ? 'FLAWLESS' : 'SWEEP'} · ${g.won}/${g.total} WON`;
}

/** Unlimited mode's row status: "5 PLAYED TODAY". */
export function unlimitedGroupStatus(playedToday: number): string {
  return `${playedToday} PLAYED TODAY`;
}

/** Morning before noon, afternoon until 5 pm, evening after (local hour 0-23). */
export function greetingWord(hour: number): 'MORNING' | 'AFTERNOON' | 'EVENING' {
  if (hour < 12) return 'MORNING';
  if (hour < 17) return 'AFTERNOON';
  return 'EVENING';
}

export interface HeadlineOptions {
  /** Local hour 0-23, for the greeting before the first puzzle. */
  hour: number;
  /** The player's username (no nickname setting, founder 2026-10-01); empty for a guest. */
  name: string;
  /** Pro's Unlimited mode: the banner reads UNLIMITED PLAY. */
  unlimited?: boolean;
}

function puzzlesLeft(n: number): string {
  return `${n} ${n === 1 ? 'PUZZLE' : 'PUZZLES'} LEFT`;
}

/**
 * The banner headline, always upper case. It moves with the day:
 * a greeting before the first puzzle, then WARMING UP → ON A ROLL → HOME
 * STRETCH, then a row's own news once one finishes, and finally the two
 * results in banner order (Wordocious first, then Puzzles).
 */
export function bannerHeadline(word: GroupProgress, puzzles: GroupProgress, opts: HeadlineOptions): string {
  if (opts.unlimited) return 'UNLIMITED PLAY';
  const a = groupTier(word);
  const b = groupTier(puzzles);
  const total = word.total + puzzles.total;
  const played = Math.min(word.played, word.total) + Math.min(puzzles.played, puzzles.total);
  const left = Math.max(0, total - played);
  if (a !== 'none' && b !== 'none') {
    if (a === 'flawless' && b === 'flawless') return 'DOUBLE FLAWLESS!';
    if (a === 'sweep' && b === 'sweep') return 'DOUBLE SWEEP!';
    return a === 'flawless' ? 'FLAWLESS + SWEEP!' : 'SWEEP + FLAWLESS!';
  }
  const news = (label: string, t: BannerTier) => `${label} ${t === 'flawless' ? 'FLAWLESS!' : 'SWEPT!'} ${puzzlesLeft(left)}`;
  if (a !== 'none') return news('WORDOCIOUS', a);
  if (b !== 'none') return news('PUZZLES', b);
  if (played === 0) {
    const name = opts.name.trim().toUpperCase();
    return name ? `GOOD ${greetingWord(opts.hour)}, ${name}!` : `GOOD ${greetingWord(opts.hour)}!`;
  }
  if (played <= 5) return `WARMING UP · ${played} DOWN`;
  if (played <= 11) return `ON A ROLL · ${played} OF ${total}`;
  return `HOME STRETCH · ${left} LEFT`;
}

/** The line under the headline. `clock` is the live HH:MM:SS countdown to local midnight. */
export function bannerClockLine(word: GroupProgress, puzzles: GroupProgress, clock: string, unlimited = false): string {
  if (unlimited) return 'FRESH PUZZLE EVERY TAP · ALL STATS COUNT';
  const total = word.total + puzzles.total;
  const played = Math.min(word.played, word.total) + Math.min(puzzles.played, puzzles.total);
  if (played >= total) return `NEW PUZZLES IN ${clock}`;
  if (played === 0) return `${total} FRESH PUZZLES · RESETS IN ${clock}`;
  return `RESETS IN ${clock}`;
}

/** The streak a row shows: its flawless run on a gold day, otherwise its sweep run. */
export function groupStreak(tier: BannerTier, streaks: { sweep: number; flawless: number }): number {
  return tier === 'flawless' ? streaks.flawless : streaks.sweep;
}

/** `YYYY-MM-DD` shifted by whole days (calendar math, no time zones involved). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Consecutive-day runs ending today, or yesterday when today isn't done yet.
 * `days` maps a local day to that day's finished and won counts; a day is a
 * sweep when `played >= total` and a flawless when `won >= total`. Used for
 * the Puzzles row (total = 10) and the Word of the Day (total = 1: a right
 * answer counts as a "won" day).
 */
export function dayStreaks(
  days: Record<string, { played: number; won: number }>,
  total: number,
  today: string,
): { sweep: number; flawless: number } {
  const run = (ok: (d: { played: number; won: number }) => boolean) => {
    const hit = (day: string) => { const v = days[day]; return !!v && ok(v); };
    let cursor = hit(today) ? today : hit(shiftDay(today, -1)) ? shiftDay(today, -1) : null;
    let n = 0;
    while (cursor && hit(cursor)) { n += 1; cursor = shiftDay(cursor, -1); }
    return n;
  };
  if (total <= 0) return { sweep: 0, flawless: 0 };
  return {
    sweep: run((v) => v.played >= total),
    flawless: run((v) => v.won >= total),
  };
}

/**
 * Lifetime totals for a set of days (founder, 2026-10-01 stats audit): how many
 * days were sweeps / flawless and the longest run of each. Feeds the All-time
 * "Puzzles Sweeps" card (total = 10) and the Word of the Day record (total = 1).
 */
export function dayRunTotals(
  days: Record<string, { played: number; won: number }>,
  total: number,
): { sweepDays: number; flawlessDays: number; bestSweep: number; bestFlawless: number } {
  if (total <= 0) return { sweepDays: 0, flawlessDays: 0, bestSweep: 0, bestFlawless: 0 };
  const tally = (ok: (d: { played: number; won: number }) => boolean) => {
    const hits = Object.keys(days).filter((k) => ok(days[k])).sort();
    let best = 0, run = 0, prev: string | null = null;
    for (const d of hits) {
      run = prev !== null && shiftDay(prev, 1) === d ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }
    return { count: hits.length, best };
  };
  const sweep = tally((v) => v.played >= total);
  const flawless = tally((v) => v.won >= total);
  return { sweepDays: sweep.count, flawlessDays: flawless.count, bestSweep: sweep.best, bestFlawless: flawless.best };
}
