-- ⚠️ MANUAL MIGRATION — More Games Stage 8, step 1. APPLIED 2026-09-22 (dashboard SQL editor); read back OK. Idempotent.
-- Appends the nine More Games game_mode keys to every game_mode CHECK
-- constraint (template: 20260521000001_add_duel6_duel7_to_constraints.sql).
-- Without these, daily_results / matches / user_stats inserts for a new game
-- fail SILENTLY (the 20260601 class of bug). Applied BEFORE the plausibility
-- function, the era functions, the era RPCs and app_flags.
--
-- Lists below = the Stage 0 snapshot's lists (RESULT.md §6) + the nine keys.
-- Read back with pg_get_constraintdef (footer).

-- daily_seeds
ALTER TABLE daily_seeds DROP CONSTRAINT IF EXISTS ds_valid_game_mode;
ALTER TABLE daily_seeds ADD CONSTRAINT ds_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7',
                       'SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS'));

-- daily_results
ALTER TABLE daily_results DROP CONSTRAINT IF EXISTS dr_valid_game_mode;
ALTER TABLE daily_results ADD CONSTRAINT dr_valid_game_mode
  CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7',
                       'SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS'));

-- matches
ALTER TABLE matches DROP CONSTRAINT IF EXISTS valid_game_mode;
ALTER TABLE matches ADD CONSTRAINT valid_game_mode
  CHECK (game_mode IN ('DUEL','MULTI_DUEL','GAUNTLET','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','TOURNAMENT','PROPERNOUNDLE','DUEL_6','DUEL_7',
                       'SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS'));

-- user_stats
ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS valid_game_mode;
ALTER TABLE user_stats ADD CONSTRAINT valid_game_mode
  CHECK (game_mode IN ('DUEL','MULTI_DUEL','GAUNTLET','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','TOURNAMENT','PROPERNOUNDLE','DUEL_6','DUEL_7',
                       'SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS'));

-- Read-back:
--   select conrelid::regclass, conname, pg_get_constraintdef(oid)
--     from pg_constraint where conname in ('ds_valid_game_mode','dr_valid_game_mode','valid_game_mode') order by 1;
