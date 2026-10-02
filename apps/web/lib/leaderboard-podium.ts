import { formatGuessStat, formatShortTime } from './format';

// The finished Leaderboard board (docs/FINISH_SPEC.md C2, C2a; mockup
// docs/design/brand/mockups/leaderboard-polish.html `.podium` / `.lrow`):
// the top three stand on a gold / silver / bronze podium, everyone else lists
// below in one tinted card, and every row's W / L badge sits in its own
// fixed-width column left of the points. Pure helpers; the look lives in
// components/leaderboard/podium.tsx and board-rows.tsx.

/** A board row with its (tie-aware, competition) rank. */
export interface Ranked<T> {
  entry: T;
  rank: number;
}

/**
 * Splits a ranked, already-filtered board (blocked rows removed, ranks kept)
 * into the podium and the rest. The podium takes the leading rows whose rank
 * is within the top `size` — at most `size` of them — so ties share a step
 * (1, 1, 3) and a hole left by a hidden row never puts rank 4 on a step.
 */
export function splitPodium<T>(rows: readonly Ranked<T>[], size = 3): { podium: Ranked<T>[]; rest: Ranked<T>[] } {
  let k = 0;
  while (k < rows.length && k < size && rows[k].rank <= size) k++;
  return { podium: rows.slice(0, k), rest: rows.slice(k) };
}

/**
 * The grid column (1–3) a podium place stands in by its board position: 1st
 * in the middle, 2nd on the left, 3rd on the right (the mockup's order). The
 * DOM keeps board order so screen readers read 1st, 2nd, 3rd.
 */
export function podiumColumn(index: number): 1 | 2 | 3 {
  return index === 0 ? 2 : index === 1 ? 1 : 3;
}

export type PodiumTone = 'gold' | 'silver' | 'bronze';

/** A step's metal by rank (ties share it): 1 gold, 2 silver, 3 bronze. */
export function podiumTone(rank: number): PodiumTone {
  return rank <= 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
}

/** A step's height (px) by metal (mockup `.s1` 74, `.s2` 54, `.s3` 40). */
export const PODIUM_STEP_HEIGHT: Record<PodiumTone, number> = { gold: 74, silver: 54, bronze: 40 };

/** C2a: the result badge a row shows in its badge column, or null (the column stays, empty). */
export type RowBadgeKind = 'won' | 'lost' | null;

/**
 * Which W / L badge a daily board row carries: solo rows always show one
 * (won → W, else L); VS rows (Records' VS board: "3W / 5G") and boards
 * without a single result (all-time Sweep) show none.
 */
export function rowBadge(entry: { completed: boolean }, playType: 'solo' | 'vs' = 'solo'): RowBadgeKind {
  if (playType !== 'solo') return null;
  return entry.completed ? 'won' : 'lost';
}

/**
 * "How you solved it" on the result card: "Solved in 4 guesses · 48s" for a
 * guess game, the mode's own words otherwise ("Solved · 0 mistakes · 2m 5s",
 * "Solved · Par · 1m"), "Genius · 3m" for a rank game, and "Not solved ·
 * 6 guesses · 2m 40s" for a miss.
 */
export function solvedLine(semantics: string, guessBase: number, guesses: number, timeSeconds: number, won: boolean): string {
  const stat = formatGuessStat(semantics, guessBase, guesses);
  const time = formatShortTime(timeSeconds);
  if (semantics === 'rank') return `${stat} · ${time}`;
  if (!won) return `Not solved · ${stat} · ${time}`;
  if (semantics === 'guesses') return `Solved in ${stat} · ${time}`;
  return `Solved · ${stat} · ${time}`;
}
