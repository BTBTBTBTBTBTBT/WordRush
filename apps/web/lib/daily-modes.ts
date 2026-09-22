/**
 * The daily-recordable modes and the per-era required sweep set — the ONE
 * source of truth shared by the live award route (/api/daily/award-bonuses),
 * the admin backfill (/api/admin/backfill-daily-bonuses), and the profile
 * sweep-stats aggregation (lib/stats-service.ts).
 *
 * Since More Games Stage 2 the data lives in packages/core/modes.json
 * (`sweepEras`) and is generated into lib/modes.generated.ts, so the web,
 * iOS, Android and the SQL era functions can never disagree. This file keeps
 * the old names as thin re-exports.
 *
 * WHY A DATED TABLE, NOT A PROBE: the award route used to infer the required
 * count from "what modes did ANYONE record that day", which meant the first
 * player of a local day could "sweep" after one game (1 >= 1) — that adaptive
 * probe poisoned daily_bonuses with fake sweeps/flawlesses. The mode set is a
 * product decision with known effective dates, so encode it as data.
 * 2026-05-21 is when DUEL_6/DUEL_7 dailies shipped (7 → 9) — a
 * hard-coded 9 would retroactively invalidate 16 real 7-mode sweeps.
 */
import { DAILY_MODES as DAILY_MODE_METAS, SWEEP_ERAS, requiredSweepCount, sweepModesFor } from './modes.generated';

/** The daily-recordable dbKeys this build knows, canonical order. */
export const DAILY_MODES: string[] = DAILY_MODE_METAS.map((m) => m.dbKey as string);

/** Mode-set eras, newest first (mirrors modes.json `sweepEras`). */
export const MODE_COUNT_ERAS: ReadonlyArray<{ since: string; count: number }> = SWEEP_ERAS.map((e) => ({ since: e.since, count: e.modes.length }));

/** How many distinct daily modes a player had to record on `day` (local YYYY-MM-DD) for a sweep. */
export function requiredDailyModeCount(day: string): number { return requiredSweepCount(day); }

export { sweepModesFor, requiredSweepCount };
