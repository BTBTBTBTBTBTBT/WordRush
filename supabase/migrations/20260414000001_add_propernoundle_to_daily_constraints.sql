-- Add PROPERNOUNDLE to the game_mode CHECK constraints on daily tables

-- daily_seeds: drop and recreate constraint
ALTER TABLE daily_seeds DROP CONSTRAINT IF EXISTS ds_valid_game_mode;
ALTER TABLE daily_seeds ADD CONSTRAINT ds_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE'));

-- daily_results: drop and recreate constraint
ALTER TABLE daily_results DROP CONSTRAINT IF EXISTS dr_valid_game_mode;
ALTER TABLE daily_results ADD CONSTRAINT dr_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE'));
