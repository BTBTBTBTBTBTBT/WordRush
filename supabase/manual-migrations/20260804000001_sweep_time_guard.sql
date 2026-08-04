-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent (create or replace only) — safe to re-run.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260804000001_sweep_time_guard.sql
--   or paste into the Supabase dashboard SQL editor.
--
-- Purpose (2026-08-04): guard the all-time sweep boards' "best sweep time".
-- The originals (20260724000001_sweep_leaderboards.sql) summed ALL of a day's
-- solo daily_results times for every sweep_awarded day with no check that the
-- day actually contains a full set of timed rows. daily_bonuses was poisoned
-- by an adaptive award bug (the first player of a local day could "sweep"
-- after ONE game), so a day with a single 14-second game could post a 14s
-- "best sweep time". Now a day's summed time only counts when the day has the
-- era's FULL count of DISTINCT timed (> 0s) daily-mode rows:
--   • 7 distinct timed modes for local days before 2026-05-21
--   • 9 distinct timed modes on/after (DUEL_6/DUEL_7 dailies shipped)
-- Keep the era split in sync with apps/web/lib/daily-modes.ts
-- (requiredDailyModeCount) and the client aggregations (web
-- stats-service.ts, iOS/Android MatchStatsService).
--
-- STRICTLY `create or replace function` on the two all-time RPCs — the
-- historical migration file is untouched, signatures are unchanged (existing
-- grants persist), and sweep_count/flawless_count still count every
-- sweep_awarded row (cleaning those flags is the backfill's job, not this
-- guard's). daily_results.day is `date`, daily_bonuses.day is `text`
-- (local YYYY-MM-DD); text comparison against '2026-05-21' is safe for ISO
-- dates. Security model unchanged: SECURITY DEFINER (narrow, read-only,
-- pinned search_path) as before.

-- ── 1. All-time sweep leaderboard (ranked by total sweeps) ───────────────────
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
           -- Day time counts only when the day holds the era's full set of
           -- distinct timed daily-mode rows; otherwise NULL (excluded below).
           (select case
                     when count(distinct dr.game_mode)
                            filter (where dr.time_seconds > 0)
                          >= (case when db.day < '2026-05-21' then 7 else 9 end)
                     then sum(dr.time_seconds)
                   end
              from daily_results dr
             where dr.user_id = db.user_id
               and dr.day = db.day::date
               and dr.play_type = 'solo'
               and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                                    'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')) as day_time
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

-- ── 2. A single user's all-time sweep rank ───────────────────────────────────
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
                          >= (case when db.day < '2026-05-21' then 7 else 9 end)
                     then sum(dr.time_seconds)
                   end
              from daily_results dr
             where dr.user_id = db.user_id
               and dr.day = db.day::date
               and dr.play_type = 'solo'
               and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                                    'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')) as day_time
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
           count(*) over ()                                                        as total
    from joined
  )
  select rnk, total from ranked where user_id = p_user;
$$;
