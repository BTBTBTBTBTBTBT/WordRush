-- Medals unique key must include medal_type.
--
-- The original key UNIQUE(user_id, day, game_mode, play_type) collides a
-- player's PERFECT medal with the next morning's PODIUM medal for the same
-- user/day/mode/'solo': the cron's write hit the same key and (under the old
-- upsert) silently overwrote the perfect medal with gold/silver/bronze. Two
-- streak milestones crossing the same day (game_mode='ALL') collided too.
--
-- The cron now INSERTs (no upsert) and skips counters/XP on conflict, so with
-- the old key it can also silently skip a legitimate podium medal whenever a
-- perfect medal exists for that day. This migration fixes both.
--
-- SAFE TO RUN ANYTIME (run in Supabase SQL Editor):

ALTER TABLE medals
  DROP CONSTRAINT IF EXISTS medals_user_id_day_game_mode_play_type_key;

-- Also handle the index-style variant in case the constraint was created
-- as a unique index rather than a table constraint.
DROP INDEX IF EXISTS medals_user_id_day_game_mode_play_type_key;

ALTER TABLE medals
  ADD CONSTRAINT medals_user_day_mode_ptype_mtype_key
  UNIQUE (user_id, day, game_mode, play_type, medal_type);
