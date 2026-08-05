-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent — the NOT EXISTS guard means a second run inserts 0 rows.
--
-- Purpose (2026-08-05): restore daily_results rows lost to the PARTIAL-loss
-- window (the retry queue marked a save complete on the XP leg while the
-- daily_results write was still unwritten — iOS hole fixed in 4c59db0, the
-- Android twin in af94773/bcb968a). Reconciliation found 8 solo daily matches
-- with no daily_results counterpart: Michael's 2026-08-05 DUEL (the row whose
-- absence the founder noticed live), 4× GAUNTLET + 1 DUEL for Ukrainian
-- Cyclone (Apr–Jul), 2 for Ssj (May). Their `matches` rows hold the ground
-- truth; this synthesizes ONLY the missing daily_results rows from them.
--
-- Column mapping (from recordSoloMatch / DailyResult in the clients):
--   composite_score = matches.player1_score   (EXACT — the leaderboard number)
--   time_seconds    = matches.player1_time
--   guess_count     = jsonb_array_length(player1_guesses)
--   completed       = winner_id = player1_id
--   hints_used      = matches.hints_used
--   total_boards    = jsonb_array_length(solutions); GAUNTLET = 21 (fixed run)
--   boards_solved   = win → total; loss → |solutions ∩ guesses| (case-folded).
--     GAUNTLET caveat: matches stores only the FINAL stage's boards, so a lost
--     run's boards_solved is a documented FLOOR (the per-stage breakdown is
--     unrecoverable for 3 of the 4 rows); composite_score stays exact, which
--     is what boards, medals, and records read.
-- No XP/stats side effects (those legs already landed — that's what defines
-- the partial-loss window). Historical medal crons for those days ran against
-- incomplete boards; past medals are NOT recomputed (accepted, documented).
insert into daily_results
  (user_id, day, game_mode, play_type, completed, guess_count, time_seconds,
   boards_solved, total_boards, composite_score, hints_used)
select
  m.player1_id,
  substring(m.seed from 7 for 10)::date,
  m.game_mode,
  'solo',
  (m.winner_id is not null and m.winner_id = m.player1_id),
  coalesce(jsonb_array_length(m.player1_guesses), 0),
  coalesce(m.player1_time, 0),
  case
    when m.winner_id is not null and m.winner_id = m.player1_id then
      case when m.game_mode = 'GAUNTLET' then 21
           else coalesce(jsonb_array_length(m.solutions), 1) end
    else
      (select count(*) from jsonb_array_elements_text(m.solutions) s
        where upper(s.value) in (select upper(g.value)
                                   from jsonb_array_elements_text(m.player1_guesses) g))
  end,
  case when m.game_mode = 'GAUNTLET' then 21
       else coalesce(jsonb_array_length(m.solutions), 1) end,
  coalesce(m.player1_score, 0),
  coalesce(m.hints_used, 0)
from matches m
where m.player2_id is null
  and m.seed like 'daily-%'
  and not exists (select 1 from daily_results dr
                   where dr.user_id = m.player1_id
                     and dr.day::text = substring(m.seed from 7 for 10)
                     and dr.game_mode = m.game_mode
                     and dr.play_type = 'solo')
returning user_id, day, game_mode, completed, composite_score, boards_solved, total_boards;
