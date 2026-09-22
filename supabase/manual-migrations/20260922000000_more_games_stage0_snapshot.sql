-- More Games, Stage 0: BEFORE snapshot. READ-ONLY — selects only, changes nothing.
-- Run in the Supabase SQL editor (project eniiqqsxpmuyrspvepiw) and keep the
-- output; every later DB step (era functions, RPC re-creation, the era switch)
-- is checked against these numbers. Run it again AFTER each step and diff.
--
-- Founder gate: production must be byte-for-byte unchanged until launch, so
-- if any of these numbers move before Stage 9, something is wrong.

-- 1. Sweep / Flawless totals to date.
select count(*) filter (where sweep_awarded)    as sweeps_awarded,
       count(*) filter (where flawless_awarded) as flawless_awarded,
       count(*)                                 as bonus_rows,
       min(day) as first_day, max(day) as last_day
from daily_bonuses;

-- 2. Per-day sweep counts for the last 14 days (should read 9-mode sweeps).
select day,
       count(*) filter (where sweep_awarded)    as sweeps,
       count(*) filter (where flawless_awarded) as flawless
from daily_bonuses
where day >= to_char(current_date - 14, 'YYYY-MM-DD')
group by day order by day;

-- 3. Three known days of the daily sweep leaderboard, top 10 each (compare row for row later).
select '2026-09-14' as day, * from daily_sweep_leaderboard('2026-09-14', 10, 0)
union all
select '2026-09-18', * from daily_sweep_leaderboard('2026-09-18', 10, 0)
union all
select '2026-09-21', * from daily_sweep_leaderboard('2026-09-21', 10, 0);

-- 4. All-time sweep leaderboard, top 20.
select * from alltime_sweep_leaderboard(20, 0);

-- 5. Distinct game_mode values in play today (the CHECK migration must list exactly these plus the eight new keys).
select game_mode, count(*) from daily_results group by game_mode order by game_mode;
select game_mode, count(*) from matches       group by game_mode order by game_mode;
select game_mode, count(*) from user_stats    group by game_mode order by game_mode;

-- 6. Current CHECK constraints on the four tables (read back after the additive migration).
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c'
  and conrelid in ('daily_seeds'::regclass, 'daily_results'::regclass, 'matches'::regclass, 'user_stats'::regclass)
order by 1, 2;

-- 7. Existing sweep RPC definitions (to confirm the era re-creation preserves signatures).
select proname, pg_get_function_identity_arguments(oid) as args, prosecdef as security_definer
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('daily_sweep_leaderboard', 'daily_sweep_rank', 'alltime_sweep_leaderboard', 'alltime_sweep_rank')
order by proname;

-- 8. Point-in-time recovery: confirm in Dashboard → Settings → Database → PITR is enabled before Stage 8.
