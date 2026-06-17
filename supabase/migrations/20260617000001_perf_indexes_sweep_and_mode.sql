-- Performance indexes for the sweep-stats + per-mode-streak queries, plus a
-- redundant-index cleanup. Authored 2026-06-17 from the backend perf audit.
--
-- APPLY MANUALLY in the Supabase SQL editor (this repo's migrations are a
-- source-of-truth record, not auto-run). All statements are additive/safe and
-- idempotent; the table sizes are small so plain CREATE INDEX locks only briefly.

-- 1. Sweep stats. Both fetchDailySweepStats() (user_id = ? AND day IN (...) AND
--    play_type = 'solo') and fetchDailyPointsOverTime() (user_id = ? AND
--    play_type = 'solo' AND day >= ?) filter user_id + play_type then scan day.
--    A single composite serves both; the existing idx_daily_results_user
--    (user_id, day) leaves play_type as an in-memory filter.
CREATE INDEX IF NOT EXISTS idx_daily_results_user_ptype_day
  ON daily_results(user_id, play_type, day DESC);

-- 2. Per-mode VS streak. fetchModeWinStreak() filters (player1_id = ? OR
--    player2_id = ?) AND game_mode = ? ORDER BY created_at DESC. The existing
--    player indexes don't include game_mode, so it's filtered in memory.
--    (Lower priority — a profile stat, not a hot path.)
CREATE INDEX IF NOT EXISTS idx_matches_player1_mode_time
  ON matches(player1_id, game_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_player2_mode_time
  ON matches(player2_id, game_mode, created_at DESC);

-- 3. Redundant index cleanup. idx_user_stats_user_mode (user_id, game_mode) is a
--    strict prefix of idx_user_stats_user_mode_type (user_id, game_mode,
--    play_type); the longer index already serves (user_id, game_mode) lookups.
DROP INDEX IF EXISTS idx_user_stats_user_mode;
