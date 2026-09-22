-- More Games Stage 4/8: the sweep RPCs on the generated era functions
-- (supabase/generated/sweep_eras.generated.sql: sweep_modes_for_day,
-- sweep_required_count), replacing the hard-coded 9 and mode list in the two
-- DAILY boards. Output is IDENTICAL to today for every existing day (7-mode
-- days before 2026-05-21, 9-mode days after) — verified against the Stage 0
-- snapshot on 2026-09-22 (2026-09-14 and 2026-09-21 rows equal).
--
-- The two ALL-TIME boards are the §226 TROPHY EPOCH versions
-- (20260820000001_trophy_epoch.sql) VERBATIM: they count daily_bonuses rows
-- from 2026-07-29 and never mention a mode list or a count, so they are already
-- era-safe. Stage 8's first pass (2026-09-22) mistakenly re-created them from
-- the older 20260804 bodies without the epoch — the all-time board briefly
-- showed pre-launch sweeps (BMT 97 instead of 46) — and was corrected within
-- minutes by re-applying the epoch bodies below. Keep them in lockstep with
-- the trophy-epoch file; the Stage 9 era switch touches neither.
--
-- APPLIED BY HAND 2026-09-22 in the Supabase SQL editor, AFTER
-- sweep_eras.generated.sql. Strictly `create or replace` with the same
-- signatures, return types, volatility and security modes as before;
-- re-running 20260804000001 + 20260820000001 rolls the daily boards back.

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

-- ── 3. All-time sweep leaderboard — §226 trophy epoch, VERBATIM ──────────────
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
      -- §226 trophy epoch: lifetime counts start at the App Store launch.
      and db.day >= '2026-07-29'
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

-- ── 4. A single user's all-time sweep rank — §226 trophy epoch, VERBATIM ─────
create or replace function public.alltime_sweep_rank(p_user uuid)
returns table(rank bigint, total_players bigint)
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
      -- §226 trophy epoch (keep in lockstep with alltime_sweep_leaderboard).
      and db.day >= '2026-07-29'
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
           count(*) over ()                                                        as total
    from joined
  )
  select rnk, total from ranked where user_id = p_user;
$$;

-- Read-back (compare to the Stage 0 snapshot, row for row):
--   select * from daily_sweep_leaderboard('2026-09-14', 10, 0);   -- 1.BMT 14930.23 1661 9 F
--   select * from daily_sweep_leaderboard('2026-09-21', 10, 0);   -- 1.BMT 16050.11 1387 9 F | 2.Oliver 11738.51 3750 7
--   select * from alltime_sweep_leaderboard(20, 0);               -- 1.BMT 46/17 750 · 2.Nichael 27/9 1071 · 3.BeanAndBuckwheat 14/3 832 · 4.Oliver 3/0 3750 · 5.Sydney McClure 1/0 3521 · 6.Michael 1/0 3823
--   select sweep_required_count('2026-05-20'), sweep_required_count('2026-05-21');  -- 7, 9
