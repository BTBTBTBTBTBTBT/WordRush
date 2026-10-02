-- ⚠️ PROPOSED MANUAL MIGRATION: NOT APPLIED. Apply by hand AFTER a backup
-- (scripts/db-backup.sh) and ONLY AFTER docs/sql/20261002-avatar-cast.sql
-- (this file reads profiles.avatar_cast_id / avatar_frame / avatar_config and
-- fails if they don't exist yet). Idempotent: safe to re-run.
--
-- FINISH_SPEC AH + AN3 (founder 2026-10-02): every leaderboard row carries
-- the player's avatar so the mascots "populate the leaderboards". The two
-- Sweep boards come from RPCs that return a fixed column list, so they gain
-- four output columns:
--   avatar_cast_id text, avatar_frame text, avatar_config jsonb,
--   is_pro boolean  (ACTIVE Pro: is_pro and (pro_expires_at is null or in the
--                    future), the same rule as every client's isProActive)
--
-- Until this is applied, web adds the same fields with one batched profiles
-- read after each RPC (apps/web/lib/daily-service.ts mergeAvatarFields), and
-- iOS/Android can do the same. After it is applied, the extra read is
-- harmless (same values), and native clients can read the columns straight
-- off the RPC rows. Shipped decoders ignore unknown keys (Swift Codable;
-- Android's KotlinXSerializer has ignoreUnknownKeys = true), so the extra
-- columns are additive for every build in the stores.
--
-- Bodies are 20260922000002_sweep_leaderboards_era.sql VERBATIM except the
-- joined CTE / final select carry the four extra columns. A RETURNS TABLE
-- change can't be done with `create or replace`, so each function is dropped
-- and re-created in one transaction, and the original grants are restored
-- (20260724000001_sweep_leaderboards.sql: anon, authenticated).
-- daily_sweep_rank / alltime_sweep_rank are untouched.
--
-- FYI (not changed here): the 20260729000005 LIMIT clamp
-- (least(greatest(coalesce(p_limit, 50), 1), 100)) is NOT in the 0804 / 0820 /
-- 0922 bodies the live functions came from, so the deployed boards pass
-- p_limit straight through. Kept verbatim to avoid a behavior change in an
-- avatar migration; worth its own follow-up.

begin;

-- ── 1. Daily sweep leaderboard ───────────────────────────────────────────────
drop function if exists public.daily_sweep_leaderboard(text, int, int);
create function public.daily_sweep_leaderboard(
  p_day text, p_limit int default 50, p_offset int default 0)
returns table(
  user_id uuid, username text, avatar_url text,
  total_score numeric, total_time int, modes_won int,
  is_flawless boolean, rank bigint,
  avatar_cast_id text, avatar_frame text, avatar_config jsonb, is_pro boolean)
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
           s.total_score, s.total_time, s.modes_won,
           p.avatar_cast_id, p.avatar_frame, p.avatar_config,
           (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now())) as is_pro
    from swept s
    join profiles p on p.id = s.user_id
    where coalesce(p.is_banned, false) = false
  )
  select user_id, username, avatar_url, total_score, total_time, modes_won,
         (modes_won = public.sweep_required_count(p_day)) as is_flawless,
         rank() over (order by total_score desc, total_time asc) as rank,
         avatar_cast_id, avatar_frame, avatar_config, is_pro
  from joined
  order by total_score desc, total_time asc
  limit p_limit offset p_offset;
$$;
grant execute on function public.daily_sweep_leaderboard(text, int, int) to anon, authenticated;

-- ── 2. All-time sweep leaderboard (§226 trophy epoch body) ───────────────────
drop function if exists public.alltime_sweep_leaderboard(int, int);
create function public.alltime_sweep_leaderboard(
  p_limit int default 50, p_offset int default 0)
returns table(
  user_id uuid, username text, avatar_url text,
  sweep_count int, flawless_count int, best_sweep_time int, rank bigint,
  avatar_cast_id text, avatar_frame text, avatar_config jsonb, is_pro boolean)
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
           a.sweep_count, a.flawless_count, a.best_sweep_time,
           p.avatar_cast_id, p.avatar_frame, p.avatar_config,
           (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now())) as is_pro
    from agg a
    join profiles p on p.id = a.user_id
    where coalesce(p.is_banned, false) = false
  )
  select user_id, username, avatar_url, sweep_count, flawless_count,
         coalesce(best_sweep_time, 0) as best_sweep_time,
         rank() over (order by sweep_count desc, best_sweep_time asc nulls last) as rank,
         avatar_cast_id, avatar_frame, avatar_config, is_pro
  from joined
  order by sweep_count desc, best_sweep_time asc nulls last
  limit p_limit offset p_offset;
$$;
grant execute on function public.alltime_sweep_leaderboard(int, int) to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Read-back: the first eight columns must equal the pre-migration output row
-- for row (compare against a select taken right before applying):
--   select user_id, username, total_score, total_time, modes_won, is_flawless, rank,
--          avatar_cast_id, avatar_frame, avatar_config is not null as has_cfg, is_pro
--   from daily_sweep_leaderboard(to_char(current_date - 1, 'YYYY-MM-DD'), 10, 0);
--   select user_id, username, sweep_count, flawless_count, best_sweep_time, rank, is_pro
--   from alltime_sweep_leaderboard(20, 0);
--   select has_function_privilege('anon', 'public.daily_sweep_leaderboard(text,int,int)', 'execute'),
--          has_function_privilege('anon', 'public.alltime_sweep_leaderboard(int,int)', 'execute');
