-- CPU / bot VS opponents: record practice games in their own bucket so they
-- never pollute ranked/human VS stats, the daily leaderboard, head-to-head,
-- per-mode streaks, or all-time records.
--
-- We extend user_stats.play_type to allow a third value, 'vs_cpu'. The unique
-- key (user_id, game_mode, play_type) already partitions by play_type, so a
-- 'vs_cpu' row lives alongside the 'solo' and 'vs' rows for the same mode with
-- no further schema change. daily_results is intentionally NOT touched — CPU
-- games never write a daily row, so they can't reach the leaderboard.

ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS valid_play_type;
ALTER TABLE user_stats ADD CONSTRAINT valid_play_type CHECK (play_type IN ('solo', 'vs', 'vs_cpu'));
