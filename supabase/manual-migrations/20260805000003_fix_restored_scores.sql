-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor).
-- Fixes 20260805000002, which wrongly copied matches.player1_score into
-- composite_score: for SOLO matches that column holds the GUESS COUNT
-- (record() passes guessCount as `score` — GameResultsService.kt:628), so the
-- 8 restored rows showed e.g. "4" instead of ~1,996 on the boards.
--
-- This recomputes composite_score with a faithful SQL port of
-- apps/web/lib/composite-scoring.ts (the single source of truth):
--   V2 (day >= 2026-07-14): 1000 win + (maxG-guesses)*weight +
--     (remaining/cap)*0.8*weight (2dp) + boards/total*200.
--   V1 (pre-cutover, frozen): 1000 win + 1pt/sec under cap + boards*200/total;
--     NO guess bonus (V1 gave it only to hint modes; none of the 8 are).
--   Losses: GAUNTLET → stage ladder with stagesCompleted unknown (0) + 6/board
--     floor; single-board → green-letter credit unknown → 0. Documented floors,
--     same as the restore's boards_solved caveat.
-- TARGETING: only rows whose composite_score still equals the matches row's
-- guess-array length — the exact fingerprint of the bad insert. Idempotent:
-- once corrected, the fingerprint no longer matches and a re-run updates 0.
with cfg(mode, v2, maxg, weight, cap) as (values
  ('DUEL', true, 6, 300, 300),      ('DUEL', false, 6, 100, 300),
  ('QUORDLE', true, 9, 150, 600),   ('QUORDLE', false, 9, 50, 600),
  ('SEQUENCE', true, 10, 180, 480), ('SEQUENCE', false, 10, 60, 480),
  ('GAUNTLET', true, 44, 60, 1800), ('GAUNTLET', false, 44, 20, 1800)
),
target as (
  select dr.id, dr.game_mode, dr.completed, dr.guess_count, dr.time_seconds,
         dr.boards_solved, dr.total_boards,
         (dr.day::text >= '2026-07-14') as v2
  from daily_results dr
  join matches m on m.player2_id is null
    and m.seed = 'daily-' || dr.day::text || '-' || dr.game_mode
    and m.player1_id = dr.user_id
  where dr.play_type = 'solo'
    and dr.composite_score = coalesce(jsonb_array_length(m.player1_guesses), 0)
),
calc as (
  select t.id,
    round(greatest(0,
      (case when t.completed then 1000 else 0 end)
      + (case when t.completed and t.v2
              then greatest(0, c.maxg - t.guess_count) * c.weight else 0 end)
      + (case when t.completed then
           case when t.v2
                then round((greatest(0, c.cap - t.time_seconds)::numeric / c.cap)
                           * 0.8 * c.weight * 100) / 100
                else greatest(0, c.cap - t.time_seconds)::numeric end
         else 0 end)
      + (case when t.completed
              then (t.boards_solved::numeric / greatest(1, t.total_boards)) * 200
              when t.game_mode = 'GAUNTLET' then 6 * t.boards_solved
              when t.total_boards = 1 then 0
              else (t.boards_solved::numeric / greatest(1, t.total_boards)) * 200 end)
    ) * 100) / 100 as total
  from target t
  join cfg c on c.mode = t.game_mode and c.v2 = t.v2
)
update daily_results dr
set composite_score = calc.total
from calc
where dr.id = calc.id
returning dr.user_id, dr.day, dr.game_mode, dr.completed, dr.guess_count,
          dr.time_seconds, dr.composite_score;
