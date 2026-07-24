-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent (create or replace + create index if not exists) — safe to re-run.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260724000001_sweep_leaderboards.sql
--   or paste into the Supabase dashboard SQL editor.
--
-- Purpose (Daily Sweep feature, 2026-07-24): read-only leaderboard RPCs that
-- rank players by their daily "sweep" (completing all 9 daily solo modes) and
-- by all-time sweep totals. All three clients (web/iOS/Android) call these
-- identical functions, so ranking is the SINGLE SOURCE OF TRUTH — no
-- per-platform aggregation drift.
--
-- STRICTLY ADDITIVE + READ-ONLY: only `create or replace function` +
-- `create index if not exists`. No table/column/trigger/RLS changes; no write
-- paths touched. The existing sweep/flawless write path
-- (awardDailyBonusesIfComplete on each platform → daily_bonuses) is untouched.
--
-- SECURITY MODEL:
--   • Daily functions read `daily_results` (already cross-user readable — the
--     per-mode leaderboard reads it under the shipped anon key) → SECURITY
--     INVOKER: they return exactly what the caller could already read, adding
--     zero privilege. is_banned is filtered INSIDE the function so ranks
--     re-close after exclusion.
--   • All-time functions read `daily_bonuses` (own-row-only SELECT RLS) →
--     SECURITY DEFINER (narrow, read-only) so they can aggregate across users.
--     They return only leaderboard-appropriate public data (username, avatar,
--     sweep/flawless counts, best time). search_path is pinned.
--
-- The 9 daily modes (keep in sync with DAILY_MODE_COUNT=9 on every platform):
--   DUEL, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, GAUNTLET, PROPERNOUNDLE,
--   DUEL_6, DUEL_7.
-- Definitions: sweep = 9 distinct solo game_mode rows for the day; modes_won =
-- count where completed; flawless = modes_won = 9. Rank by total composite
-- score DESC, tiebreak total time ASC (mirrors the per-mode board's
-- composite_score DESC, created_at ASC).
--
-- Type note: daily_results.day is `date`, daily_bonuses.day is `text`
-- (local YYYY-MM-DD). Clients pass a text day; cast as needed.

-- ── 1. Daily sweep leaderboard (today's sweepers, ranked by score) ────────────
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
  limit p_limit offset p_offset;
$$;

-- ── 2. A single user's daily sweep rank (mirrors getUserDailyRank) ────────────
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
      and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                           'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')
    group by dr.user_id
    having count(distinct dr.game_mode) = 9
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

-- ── 3. All-time sweep leaderboard (ranked by total sweeps) ────────────────────
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

-- ── Grants (client roles call these read-only functions) ─────────────────────
grant execute on function public.daily_sweep_leaderboard(text, int, int) to anon, authenticated;
grant execute on function public.daily_sweep_rank(text, uuid)            to anon, authenticated;
grant execute on function public.alltime_sweep_leaderboard(int, int)     to anon, authenticated;
grant execute on function public.alltime_sweep_rank(uuid)                to anon, authenticated;

-- ── Covering index for the daily per-day cross-mode group-by ─────────────────
-- The existing idx_daily_results_leaderboard is (day, game_mode, play_type,
-- composite_score) — wrong leading columns for a group-by across all modes for
-- a day. This one covers daily_sweep_leaderboard's scan.
create index if not exists idx_daily_results_day_playtype
  on public.daily_results (day, play_type)
  include (user_id, game_mode, completed, composite_score, time_seconds);
