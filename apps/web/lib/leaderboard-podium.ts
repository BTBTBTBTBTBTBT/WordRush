import { podiumLayout, podiumOpenSpot } from '@wordle-duel/core';
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
 * FINISH_SPEC BJ4: the split is core podiumLayout (parity with iOS / Android);
 * `open` = the places still free, drawn as open spots.
 */
export function splitPodium<T>(rows: readonly Ranked<T>[], size = 3): { podium: Ranked<T>[]; rest: Ranked<T>[]; open: number[] } {
  const { filled, open } = podiumLayout(rows.map((r) => r.rank), size);
  return { podium: rows.slice(0, filled), rest: rows.slice(filled), open };
}

/** One podium column: a player standing on a step, or an open spot (BJ4). */
export type PodiumSlot =
  | { kind: 'place'; index: number; column: 1 | 2 | 3 }
  | { kind: 'open'; place: number; column: 1 | 2 | 3; title: string; line: string };

/**
 * FINISH_SPEC BJ4: what the podium draws for N leading places — each place in
 * its column (1st middle, 2nd left, 3rd right; DOM keeps board order) and
 * every free place as an open spot in the column its place would take.
 * Empty (no podium) when nobody stands on it.
 */
export function podiumSlots(ranks: readonly number[]): PodiumSlot[] {
  const { filled, open } = podiumLayout(ranks);
  if (filled === 0) return [];
  const slots: PodiumSlot[] = [];
  for (let i = 0; i < filled; i++) slots.push({ kind: 'place', index: i, column: podiumColumn(i) });
  for (const place of open) {
    const spot = podiumOpenSpot(place);
    slots.push({ kind: 'open', place, column: podiumColumn(place - 1), title: spot.title, line: spot.line });
  }
  return slots;
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

/** The compact podium's step heights (Yesterday's small copy, founder 10-09; iOS PodiumView compact 62 / 46 / 34). */
export const PODIUM_STEP_HEIGHT_COMPACT: Record<PodiumTone, number> = { gold: 62, silver: 46, bronze: 34 };

/**
 * Podium glow (2.8 TestFlight feedback: "a glow behind the characters so they stand out"): the soft radial light behind
 * each standing figure, one clearly different hue per metal — gold (warm, with twinkling sparkles), silver (cool blue-white),
 * bronze (copper orange). `core` is the glow's bright center, `alpha` its peak opacity, `scale` its diameter as a multiple
 * of the figure's height. Mirrored hex-for-hex on iOS (PodiumGlow) and Android (PodiumGlow).
 */
export const PODIUM_GLOW: Record<PodiumTone, { core: string; alpha: number; scale: number }> = {
  gold: { core: '#FFC93C', alpha: 0.8, scale: 1.55 },
  silver: { core: '#B4C8EE', alpha: 0.75, scale: 1.4 },
  bronze: { core: '#F28A3B', alpha: 0.7, scale: 1.4 },
};

/** The gold glow's twinkling sparkles: position (% of the glow box), size (px) and animation delay (s). Static under calm motion. */
export const PODIUM_SPARKLES: ReadonlyArray<{ x: number; y: number; size: number; delay: number }> = [
  { x: 14, y: 30, size: 9, delay: 0 },
  { x: 86, y: 24, size: 7, delay: 0.7 },
  { x: 24, y: 74, size: 6, delay: 1.3 },
  { x: 80, y: 68, size: 8, delay: 0.35 },
];

/** The place number a metal stands for (gold 1, silver 2, bronze 3). */
export const PODIUM_TONE_PLACE: Record<PodiumTone, 1 | 2 | 3> = { gold: 1, silver: 2, bronze: 3 };

/**
 * The pedestal art (10-03, docs/design/brand/podium): `art-podium-N` wears its numeral;
 * a step whose label isn't its metal's number takes the plain pedestal (the label drawn on it).
 */
export function podiumPedestalArt(place: number, label?: number): `art-podium-${1 | 2 | 3}${'' | '-plain'}` {
  const p = (place <= 1 ? 1 : place === 2 ? 2 : 3) as 1 | 2 | 3;
  return label === undefined || label === p ? `art-podium-${p}` : `art-podium-${p}-plain`;
}

/** The sprites every podium shows first (the numbered pedestals + the floor plate). */
export const PODIUM_PRELOAD = ['art-podium-1', 'art-podium-2', 'art-podium-3', 'art-podium-floor'] as const;

let podiumPreloaded = false;
/**
 * Warm the podium sprites into the image cache (decoded off the main thread via
 * `img.decode()`) when the Leaderboard / Home first mount, so the podium never pops in.
 */
export function preloadPodiumArt(src: (name: string) => string): void {
  if (podiumPreloaded || typeof window === 'undefined' || typeof Image === 'undefined') return;
  podiumPreloaded = true;
  for (const name of PODIUM_PRELOAD) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src(name);
    img.decode?.().catch(() => {});
  }
}

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

/**
 * FINISH_SPEC AU2: the Leaderboard's ONE compact rank row — "#2 of 5 · 2,005 PTS
 * · 4 guesses · 48s" (no repeated headline / "OF 5 TODAY"). Missing pieces drop
 * out; `detail` replaces the guess + time stats (the Sweep's totals line).
 */
export function compactRankLine(p: {
  rank: number | null; total: number | null; friends?: boolean; points: string | null;
  semantics?: string; guessBase?: number; guesses?: number | null; timeSeconds?: number | null; detail?: string | null;
}): string {
  const parts: string[] = [];
  if (p.rank != null) parts.push(`#${p.rank}${p.total != null ? ` of ${p.total}${p.friends ? ' friends' : ''}` : ''}`);
  if (p.points) parts.push(`${p.points} PTS`);
  if (p.detail) parts.push(p.detail);
  else {
    if (p.guesses != null) parts.push(formatGuessStat(p.semantics ?? 'guesses', p.guessBase ?? 1, p.guesses));
    if (p.timeSeconds != null) parts.push(formatShortTime(p.timeSeconds));
  }
  return parts.length ? parts.join(' \u00b7 ') : 'Your result';
}
