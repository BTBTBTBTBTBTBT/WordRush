// ============================================================
// Shared display formatters — cross-platform contract
// ============================================================
// The web copy is the source of truth; iOS (Sources/Core/Format.swift) and
// Android (ui/Format.kt) mirror it 1:1 and all three are pinned by
// display-format-fixtures.json (regenerate with
// scripts/gen-display-format-fixtures.mjs after any change here).
// These exist because each platform hand-rolled its own versions and they
// drifted: web rounded percentiles where native truncated ("Top 12%" vs
// "Top 13%" for the same rank), and iOS showed "—" where web/Android showed
// "0s". Keep them dependency-free so the fixture generator can import them.

/**
 * The daily post-game rank badge: percentile of the field you beat, rounded
 * (user decision 2026-07-16: ROUND is canonical — matches win-rate rounding).
 * `gold` drives the amber styling at the 75th percentile.
 *
 * NOTE: this is the (1 - (rank-1)/total) definition used by the post-game
 * badge. The records page uses rank/total — a different, deliberately
 * separate metric; do not unify them.
 */
export function topPercentLabel(rank: number, totalPlayers: number): { label: string; gold: boolean } {
  const percentile = Math.round((1 - (rank - 1) / totalPlayers) * 100);
  return {
    label: `Top ${Math.max(1, 100 - percentile)}%`,
    gold: percentile >= 75,
  };
}

/**
 * Compact time for leaderboard/records/summary rows: "0s", "45s", "2m",
 * "2m 5s". Zero is a real value ("0s"), never a dash — iOS's "—" variant
 * diverged here.
 */
export function formatShortTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// ── More Games (§11): guess_count is not always "guesses" ─────────────────
// Each mode's catalog record says what guess_count MEANS (guessSemantics) and
// what a perfect run is (guessBase). This single formatter turns the stored
// number into the words a player should read, on every surface (home card,
// leaderboard row, records, share text). Mirrored 1:1 in Format.swift and
// Format.kt and pinned by display-format-fixtures.json.
//
//   guesses  → "4 guesses"          (raw count; the word games)
//   mistakes → "0 mistakes"         (guess_count − guessBase; Sudocious, Starsweep)
//   checks   → "5 checks"           (Muddle counts every check, base 5)
//              "2 checks"           (Crosswordocious / Codebreaker: optional Checks, base 1)
//   overPar  → "Par" / "+2"         (Letter Ladder: guess_count − 1 over par)
//   misses   → "3 misses"           (Spyglass: guess_count − 10)
//   rank     → "Hubbub"             (Hubbub: rank position 1..10 → name)

/** Hubbub rank names, best first: guess_count 1 = Pandemonium … 10 = Hush. */
export const HUB_RANK_NAMES = ['Pandemonium', 'Thunder', 'Uproar', 'Hubbub', 'Racket', 'Clamor', 'Banter', 'Chatter', 'Murmur', 'Hush'] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function formatGuessStat(semantics: string, guessBase: number, guessCount: number): string {
  const g = Math.max(0, Math.floor(guessCount));
  switch (semantics) {
    case 'mistakes': return plural(Math.max(0, g - guessBase), 'mistake', 'mistakes');
    case 'checks': return plural(guessBase === 1 ? Math.max(0, g - 1) : g, 'check', 'checks');
    case 'overPar': { const d = g - 1; return d <= 0 ? 'Par' : `+${d}`; }
    case 'misses': return plural(Math.max(0, g - guessBase), 'miss', 'misses');
    case 'rank': return HUB_RANK_NAMES[Math.min(HUB_RANK_NAMES.length, Math.max(1, g)) - 1];
    default: return plural(g, 'guess', 'guesses');
  }
}
