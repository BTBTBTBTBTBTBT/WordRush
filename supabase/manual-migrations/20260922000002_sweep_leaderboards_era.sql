-- More Games Stage 4/8: the four sweep RPCs re-created on the generated era
-- functions (supabase/generated/sweep_eras.generated.sql: sweep_modes_for_day,
-- sweep_required_count), replacing the hard-coded 9 and mode list. Output is
-- IDENTICAL to today for every existing day (7-mode days before 2026-05-21,
-- 9-mode days after) — compare against the Stage 0 snapshot after applying.
-- The Stage 9 era switch is then one regenerated function, never an RPC edit.
--
-- APPLY BY HAND in the Supabase SQL editor (project eniiqqsxpmuyrspvepiw),
-- AFTER sweep_eras.generated.sql. Strictly `create or replace` with the same
-- signatures, return types, volatility and security modes as
-- 20260724000001_sweep_leaderboards.sql / 20260804000001_sweep_time_guard.sql;
-- re-running those two files rolls this back.

-- ── 1. Daily sweep leaderboard (a day's sweepers, ranked by score) ───────────
create or replace function public.daily_sweep_leaderboard(
  p_day text, p_limit int default 50, p_offset int default 0)
returns table(
  user_id uuid, username text, avatar_url text,
  total_score numeric, total_time int, modes_won int,
  is_flawless boolean, rank bigint)
language sql stable security invoker
set search_path = public
as $$
  with swept as (
    select dr.user_id,
           sum(dr.composite_score)                    as total_score,
           sum(dr.time_seconds)::int                  as total_time,
           count(*) filter (where dr.completed)::int  as modes_won
    from daily_results dr
    where dr.day = p_day::date
      and dr.play_type = 'solo'
      and dr.game_mode = any (public.sweep_modes_for_day(p_day))
    group by dr.user_id
    having count(distinct dr.game_mode) = public.sweep_required_count(p_day)
  ),
  joined as (
    select s.user_id, p.username, p.avatar_url,
           s.total_score, s.total_time, s.modes_won
    from swept s
    join profiles p on p.id = s.user_id
    where coalesce(p.is_banned, false) = false
  )
  select user_id, username, avatar_url, total_score, total_time, modes_won,
         (modes_won = public.sweep_required_count(p_day)) as is_flawless,
         rank() over (order by total_score desc, total_time asc) as rank
  from joined
  order by total_score desc, total_time asc
  limit p_limit offset p_offset;
$$;

-- ── 2. A single user's daily sweep rank ─────────────────────────────────────
create or replace function public.daily_sweep_rank(p_day text, p_user uuid)
returns table(rank bigint, total_players bigint)
language sql stable security invoker
set search_path = public
as $$
  with swept as (
    select dr.user_id,
           sum(dr.composite_score) as total_score,
           sum(dr.time_seconds)    as total_time
    from daily_results dr
    where dr.day = p_day::date
      and dr.play_type = 'solo'
      and dr.game_mode = any (public.sweep_modes_for_day(p_day))
    group by dr.user_id
    having count(distinct dr.game_mode) = public.sweep_required_count(p_day)
  ),
  joined as (
    select s.user_id, s.total_score, s.total_time
    from swept s
    join profiles p on p.id = s.user_id
    where coalesce(p.is_banned, false) = false
  ),
  ranked as (
    select user_id,
           rank() over (order by total_score desc, total_time asc) as rnk,
           count(*) over ()                                        as total
    from joined
  )
  select rnk, total from ranked where user_id = p_user;
$$;

-- ── 3. All-time sweep leaderboard (ranked by total sweeps) ───────────────────
create or replace function public.alltime_sweep_leaderboard(
  p_limit int default 50, p_offset int default 0)
returns table(
  user_id uuid, username text, avatar_url text,
  sweep_count int, flawless_count int, best_sweep_time int, rank bigint)
language sql stable security definer
set search_path = public
as $$
  with per_day as (
    select db.user_id, db.flawless_awarded,
           -- Day time counts only when the day holds its era's full set of
           -- distinct timed sweep-mode rows; otherwise NULL (excluded below).
           (select case
                     when count(distinct dr.game_mode)
                            filter (where dr.time_seconds > 0)
                          >= public.sweep_required_count(db.day)
                     then sum(dr.time_seconds)
                   end
              from daily_results dr
             where dr.user_id = db.user_id
               and dr.day = db.day::date
               and dr.play_type = 'solo'
               and dr.game_mode = any (public.sweep_modes_for_day(db.day))) as day_time
    from daily_bonuses db
    where db.sweep_awarded = true
  ),
  agg as (
    select user_id,
           count(*)::int                                  as sweep_count,
           count(*) filter (where flawless_awarded)::int  as flawless_count,
           min(day_time) filter (where day_time > 0)::int as best_sweep_time
    from per_day
    group by user_id
  ),
  joined as (
    select a.user_id, p.username, p.avatar_url,
           a.sweep_count, a.flawless_count, a.best_sweep_time
    from agg a
    join profiles p on p.id = a.user_id
    where coalesce(p.is_banned, false) = false
  )
  select user_id, username, avatar_url, sweep_count, flawless_count,
         coalesce(best_sweep_time, 0) as best_sweep_time,
         rank() over (order by sweep_count desc, best_sweep_time asc nulls last) as rank
  from joined
  order by sweep_count desc, best_sweep_time asc nulls last
  limit p_limit offset p_offset;
$$;

-- ── 4. A single user's all-time sweep rank ───────────────────────────────────
create or replace function public.alltime_sweep_rank(p_user uuid)
returns table(rank bigint, total_players bigint)
language sql stable security definer
set search_path = public
as $$
  with per_day as (
    select db.user_id, db.flawless_awarded,
           (select case
                     when count(distinct dr.game_mode)
                            filter (where dr.time_seconds > 0)
                          >= public.sweep_required_count(db.day)
                     then sum(dr.time_seconds)
                   end
              from daily_results dr
             where dr.user_id = db.user_id
               and dr.day = db.day::date
               and dr.play_type = 'solo'
               and dr.game_mode = any (public.sweep_modes_for_day(db.day))) as day_time
    from daily_bonuses db
    where db.sweep_awarded = true
  ),
  agg as (
    select user_id,
           count(*)::int                                  as sweep_count,
           min(day_time) filter (where day_time > 0)::int as best_sweep_time
    from per_day
    group by user_id
  ),
  joined as (
    select a.user_id, a.sweep_count, a.best_sweep_time
    from agg a
    join profiles p on p.id = a.user_id
    where coalesce(p.is_banned, false) = false
  ),
  ranked as (
    select user_id,
           rank() over (order by sweep_count desc, best_sweep_time asc nulls last) as rnk,
           count(*) over () as total
    from joined
  )
  select rnk, total from ranked where user_id = p_user;
$$;

-- Read-back (compare to the Stage 0 snapshot, row for row):
--   select * from daily_sweep_leaderboard('2026-09-14', 10, 0);
--   select * from daily_sweep_leaderboard('2026-09-21', 10, 0);
--   select * from alltime_sweep_leaderboard(20, 0);
--   select sweep_required_count('2026-05-20'), sweep_required_count('2026-05-21');  -- 7, 9
