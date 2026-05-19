-- Add PROPERNOUNDLE to matches valid_game_mode constraint
-- The original migration (20260414000001) only updated daily_seeds and
-- daily_results but missed the matches table, causing all PROPERNOUNDLE
-- match inserts to silently fail (the app catches the error).
ALTER TABLE matches DROP CONSTRAINT IF EXISTS valid_game_mode;
ALTER TABLE matches ADD CONSTRAINT valid_game_mode
  CHECK (game_mode IN ('DUEL', 'MULTI_DUEL', 'GAUNTLET', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'TOURNAMENT', 'PROPERNOUNDLE'));
