// FINISH_SPEC AS7: every streak in the streak-flame popup (the Home banner rows
// lost their small flames). Pure, so the rules are tested.

export interface StreakRun {
  current: number;
  /** null when the best run isn't tracked. */
  best: number | null;
}

export interface StreakSummary {
  wordSweep: StreakRun;
  puzzleSweep: StreakRun;
  wordFlawless: StreakRun;
  puzzleFlawless: StreakRun;
}

export const EMPTY_STREAK_SUMMARY: StreakSummary = {
  wordSweep: { current: 0, best: null },
  puzzleSweep: { current: 0, best: 0 },
  wordFlawless: { current: 0, best: 0 },
  puzzleFlawless: { current: 0, best: 0 },
};

export interface FlawlessRow { key: 'word' | 'puzzles'; label: string; current: number; best: number }

/**
 * The flawless section's rows (founder 10-02): Wordocious and Puzzles, each
 * shown whenever its current OR best run is above 0 — hidden only when that
 * flawless streak has never happened. Best never reads below current.
 */
export function flawlessRows(s: StreakSummary): FlawlessRow[] {
  const rows: FlawlessRow[] = [
    { key: 'word', label: 'Wordocious', current: s.wordFlawless.current, best: Math.max(s.wordFlawless.best ?? 0, s.wordFlawless.current) },
    { key: 'puzzles', label: 'Puzzles', current: s.puzzleFlawless.current, best: Math.max(s.puzzleFlawless.best ?? 0, s.puzzleFlawless.current) },
  ];
  return rows.filter((r) => r.current > 0 || r.best > 0);
}

/** The sweep chips (always shown, regular style): current, and best when tracked. */
export function sweepRows(s: StreakSummary): Array<{ key: 'word' | 'puzzles'; label: string; current: number; best: number | null }> {
  const best = (r: StreakRun) => (r.best == null ? null : Math.max(r.best, r.current));
  return [
    { key: 'word', label: 'Wordocious', current: s.wordSweep.current, best: best(s.wordSweep) },
    { key: 'puzzles', label: 'Puzzles', current: s.puzzleSweep.current, best: best(s.puzzleSweep) },
  ];
}
