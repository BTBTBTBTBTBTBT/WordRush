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
