-- FINISH_SPEC BJ12 (2026-10-03) — More Games Perfect medals backfill.
-- APPLIED 2026-10-03 ~17:32 CT after backup 20261003T223050Z: INSERT 0 86, read back
-- OK (counts match the header). No triggers on public.medals. Idempotent — safe to re-run.
--
-- Why: iOS (MedalService.swift) and Android (MedalService.kt) awarded the
-- Perfect medal from a hand-typed switch of the nine word modes, so no More
-- Games puzzle ever earned one on a phone (web read the catalog). Read-only
-- prod check 10-03: ZERO perfect medals exist for SUDOKU, SCRAMBLE, HUB,
-- CROSSWORD, GROUPS, LADDER, CRYPTOGRAM, WORDSEARCH or REGIONS, against 86
-- qualifying solo daily_results rows since launch (09-22) — CROSSWORD 16,
-- LADDER 15, SCRAMBLE 13, CRYPTOGRAM 12, SUDOKU 9, REGIONS 8, GROUPS 6,
-- WORDSEARCH 5, HUB 2. Those players never got the "played a perfect …"
-- Moment. The apps now share packages/core isPerfectDailyResult; this inserts
-- the medals they should have earned.
--
-- Rule (the catalog's, packages/core/src/mode-coverage.ts): a completed solo
-- daily with 1 <= guess_count <= guessBase and every board solved. guessBase
-- per modes.json: SCRAMBLE 5, GROUPS 4, WORDSEARCH 10, the rest 1.
-- (PROPERNOUNDLE keeps its explicit word-mode rule and was always awarded.)
--
-- created_at = the result's own time, so the Moments feed files each medal
-- under its day (the feed reads the last 7 days: ~55 of these fall inside it
-- and will show as "played a perfect …" moments for those days).
-- Perfect medals grant no XP and touch no profile counter — insert only.

begin;

with base(game_mode, guess_base) as (
  values ('SUDOKU', 1), ('SCRAMBLE', 5), ('HUB', 1), ('CROSSWORD', 1), ('GROUPS', 4),
         ('LADDER', 1), ('CRYPTOGRAM', 1), ('WORDSEARCH', 10), ('REGIONS', 1)
)
insert into public.medals (user_id, day, game_mode, play_type, medal_type, composite_score, created_at)
select d.user_id, d.day, d.game_mode, 'solo', 'perfect', d.guess_count, d.updated_at
from public.daily_results d
join base b on b.game_mode = d.game_mode
where d.play_type = 'solo'
  and d.completed
  and d.guess_count between 1 and b.guess_base
  and d.boards_solved >= d.total_boards
on conflict (user_id, day, game_mode, play_type, medal_type) do nothing;

commit;

-- Read back (expect one row per mode above, counts matching the header):
-- select game_mode, count(*), min(day), max(day) from public.medals
--  where medal_type = 'perfect' and game_mode in
--    ('SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS')
--  group by 1 order by 1;
