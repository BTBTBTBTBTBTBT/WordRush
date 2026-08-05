-- ⚠️ MANUAL MIGRATION — apply by hand. Companion to 20260805000003 (pass 2).
-- Pass 1 fixed 4 of the 8 restored rows: its fingerprint compared against
-- jsonb_array_length(player1_guesses), but for GAUNTLET the copied value was
-- the TOTAL RUN guess count (summed across stages — computeRunScore), which
-- differs from the final-stage guess array. This pass targets the copied
-- value itself: composite_score = matches.player1_score, restricted to rows
-- created today (the restore) with composite_score < 900 (every bad value is
-- a guess count; every legitimate win is >= 1000 and legit losses can't
-- equal player1_score under these joins). Same calc as pass 1. Idempotent.
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
    and dr.created_at >= '2026-08-05'
    and dr.composite_score < 900
    and dr.composite_score = coalesce(m.player1_score, 0)
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
