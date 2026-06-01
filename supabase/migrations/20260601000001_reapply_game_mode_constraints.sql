/*
  # Re-apply game_mode CHECK constraints (PROPERNOUNDLE / DUEL_6 / DUEL_7)

  Symptom this fixes: finishing the daily **ProperNoundle** greys out + locks
  the Home card (the freemium `play_limits` write succeeds) but never shows a
  W/L badge and is not counted in the Profile "Today's Dailies". Root cause:
  `recordGameResult` writes `user_stats` + `daily_results` with
  `game_mode = 'PROPERNOUNDLE'`, but if the production CHECK constraints still
  predate the mode (only DUEL/QUORDLE/OCTORDLE/SEQUENCE/RESCUE/GAUNTLET), the
  inserts are rejected. supabase-js returns `{ error }` (it does NOT throw) and
  the result isn't inspected, so the failure is silent — no row, no badge.

  This re-states every game_mode constraint with the full current mode list so
  the live DB matches the app, regardless of which earlier constraint
  migrations (20260414000001 / 20260519000001 / 20260521000001) actually landed
  in production. Fully idempotent (DROP IF EXISTS + ADD). Also fixes the same
  class of silent failure for DUEL_6 / DUEL_7 (Six / Seven).
*/

-- daily_seeds
ALTER TABLE daily_seeds DROP CONSTRAINT IF EXISTS ds_valid_game_mode;
ALTER TABLE daily_seeds ADD CONSTRAINT ds_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7'));

-- daily_results
ALTER TABLE daily_results DROP CONSTRAINT IF EXISTS dr_valid_game_mode;
ALTER TABLE daily_results ADD CONSTRAINT dr_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7'));

-- matches
ALTER TABLE matches DROP CONSTRAINT IF EXISTS valid_game_mode;
ALTER TABLE matches ADD CONSTRAINT valid_game_mode
  CHECK (game_mode IN ('DUEL','MULTI_DUEL','GAUNTLET','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','TOURNAMENT','PROPERNOUNDLE','DUEL_6','DUEL_7'));

-- user_stats
ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS valid_game_mode;
ALTER TABLE user_stats ADD CONSTRAINT valid_game_mode
  CHECK (game_mode IN ('DUEL','MULTI_DUEL','GAUNTLET','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','TOURNAMENT','PROPERNOUNDLE','DUEL_6','DUEL_7'));
