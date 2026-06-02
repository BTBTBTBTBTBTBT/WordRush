-- Dedupe all_time_records + prevent future duplicates.
--
-- Global records (game_mode / play_type = NULL) accumulated hundreds of
-- duplicate rows: a plain UNIQUE(record_type, game_mode, play_type) constraint
-- treats NULLs as DISTINCT, so the app's `upsert onConflict(...)` never matched
-- a NULL-keyed row and inserted a fresh one every game. The table grew past the
-- PostgREST 1000-row read cap, pushing the alphabetically-last record types
-- (`most_games_played`, `most_gold_medals`) out of the records page entirely.
--
-- 1) Collapse duplicates, keeping the genuine record holder per key
--    (lowest value for time/guess records, highest for everything else).
-- 2) Add a NULLS NOT DISTINCT unique index (Postgres 15+) so NULL-keyed global
--    records can never duplicate again.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY record_type, game_mode, play_type
      ORDER BY
        CASE WHEN record_type IN ('fastest_win', 'fewest_guesses')
             THEN record_value END ASC  NULLS LAST,   -- lower is better
        CASE WHEN record_type NOT IN ('fastest_win', 'fewest_guesses')
             THEN record_value END DESC NULLS LAST,    -- higher is better
        updated_at DESC NULLS LAST
    ) AS rn
  FROM public.all_time_records
)
DELETE FROM public.all_time_records
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Drop any legacy non-NULL-safe unique constraint/index if present, then add
-- the NULLS NOT DISTINCT one. (The constraint name may not exist; ignore.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'all_time_records_record_type_game_mode_play_type_key'
  ) THEN
    ALTER TABLE public.all_time_records
      DROP CONSTRAINT all_time_records_record_type_game_mode_play_type_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS all_time_records_key_uidx
  ON public.all_time_records (record_type, game_mode, play_type) NULLS NOT DISTINCT;
