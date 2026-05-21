-- Add DUEL_6 and DUEL_7 to all game_mode CHECK constraints
-- Without these, daily results and match inserts for Six/Seven silently fail.

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
