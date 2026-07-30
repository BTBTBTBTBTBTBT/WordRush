-- Clamp the sweep leaderboard RPC page sizes.
--
-- daily_sweep_leaderboard / alltime_sweep_leaderboard passed p_limit and
-- p_offset straight into LIMIT/OFFSET, and both are granted to `anon` — so an
-- UNAUTHENTICATED caller could ask for p_limit = 100000000 and make the
-- database materialize the whole aggregation, repeatedly. The rows are public
-- leaderboard data, so this is a cost/availability problem rather than a
-- disclosure one, but it is free to close.
--
-- 100 sits comfortably above the 50 every caller actually requests. The
-- function bodies below are copied VERBATIM from
-- 20260724000001_sweep_leaderboards.sql — only the LIMIT/OFFSET line changed.

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
      and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                           'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')
    group by dr.user_id
    having count(distinct dr.game_mode) = 9
  ),
  joined as (
    select s.user_id, p.username, p.avatar_url,
           s.total_score, s.total_time, s.modes_won
    from swept s
    join profiles p on p.id = s.user_id
    where coalesce(p.is_banned, false) = false
  )
  select user_id, username, avatar_url, total_score, total_time, modes_won,
         (modes_won = 9) as is_flawless,
         rank() over (order by total_score desc, total_time asc) as rank
  from joined
  order by total_score desc, total_time asc
  limit  least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

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
           (select sum(dr.time_seconds) from daily_results dr
             where dr.user_id = db.user_id
               and dr.day = db.day::date
               and dr.play_type = 'solo') as day_time
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
  limit  least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.daily_sweep_leaderboard(text, int, int) to anon, authenticated;
grant execute on function public.alltime_sweep_leaderboard(int, int)     to anon, authenticated;
