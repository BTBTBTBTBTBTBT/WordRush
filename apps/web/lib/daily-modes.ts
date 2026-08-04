/**
 * The daily-recordable modes and the per-era required sweep count — the ONE
 * source of truth shared by the live award route (/api/daily/award-bonuses),
 * the admin backfill (/api/admin/backfill-daily-bonuses), and the profile
 * sweep-stats aggregation (lib/stats-service.ts).
 *
 * WHY A DATED TABLE, NOT A PROBE: the award route used to infer the required
 * count from "what modes did ANYONE record that day", which meant the first
 * player of a local day could "sweep" after one game (1 >= 1) — that adaptive
 * probe poisoned daily_bonuses with fake sweeps/flawlesses. The mode set is a
 * product decision with known effective dates, so encode it as data.
 *
 * Keep the era list in sync with the SQL guard in
 * supabase/manual-migrations/20260804000001_sweep_time_guard.sql.
 */

/** The daily-recordable modes today. Keep in step with lib/daily-service.ts. */
export const DAILY_MODES: string[] = [
  'DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE',
  'GAUNTLET', 'PROPERNOUNDLE', 'DUEL_6', 'DUEL_7',
];

/**
 * Mode-set eras, newest first. Each entry: the first local day (YYYY-MM-DD)
 * the count applies, and the number of daily modes on offer from that day.
 * 2026-05-21 is when DUEL_6/DUEL_7 dailies shipped (7 → 9 modes) — a
 * hard-coded 9 would retroactively invalidate 16 real 7-mode sweeps
 * (verified against production data). Append a new entry when the set
 * changes again.
 */
const MODE_COUNT_ERAS: ReadonlyArray<{ since: string; count: number }> = [
  { since: '2026-05-21', count: 9 },
  { since: '0000-00-00', count: 7 },
];

/**
 * How many distinct daily modes a player must record on `day` (local
 * YYYY-MM-DD) for that day to count as a sweep. String comparison is safe on
 * ISO dates.
 */
export function requiredDailyModeCount(day: string): number {
  for (const era of MODE_COUNT_ERAS) {
    if (day >= era.since) return era.count;
  }
  return MODE_COUNT_ERAS[MODE_COUNT_ERAS.length - 1].count;
}
