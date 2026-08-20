-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent — safe to re-run (the counter recompute recalculates from rows,
-- never increments).
--
-- Apply:  paste into the Supabase dashboard SQL editor.
--
-- TROPHY EPOCH (§226, founder decision 2026-08-20): competitive trophies
-- count only from TROPHY_EPOCH_DATE = 2026-07-29 — the day iOS 1.1 went
-- live on the App Store (the same bible entry that records the first real
-- Android tester, so every non-founder account's era is preserved intact).
-- The founder's months of solo pre-launch play had banked walls of
-- default-gold medals and an unassailable all-time sweep count; a global
-- epoch is a rule, not surgery on one account.
--
-- NOTHING IS DELETED: the `medals` and `daily_bonuses` rows all remain.
-- Pre-epoch rows simply stop being counted:
--   1. profiles.gold/silver/bronze_medals are RECOMPUTED from post-epoch
--      medal rows (XP and levels are untouched — those are stats, not
--      trophies, per the founder's "keep my stats" call).
--   2. The all-time sweep RPCs gain `day >= epoch` so lifetime sweep and
--      flawless counts (and best time) start at launch. Server-side, so
--      every shipped client shows corrected boards with no app update.
-- The daily-medals cron is untouched — it only ever awards yesterday.

-- ── 1. Recompute the profile medal counters from post-epoch rows ─────────────
update public.profiles p
set gold_medals = coalesce(m.gold, 0),
    silver_medals = coalesce(m.silver, 0),
    bronze_medals = coalesce(m.bronze, 0)
from (
  select user_id,
         count(*) filter (where medal_type = 'gold')   as gold,
         count(*) filter (where medal_type = 'silver') as silver,
         count(*) filter (where medal_type = 'bronze') as bronze
  from public.medals
  where day >= '2026-07-29'
  group by user_id
) m
where p.id = m.user_id;

-- Zero anyone whose medals are ALL pre-epoch (the subquery above only
-- touches users with at least one post-epoch medal).
update public.profiles p
set gold_medals = 0, silver_medals = 0, bronze_medals = 0
where (p.gold_medals > 0 or p.silver_medals > 0 or p.bronze_medals > 0)
  and not exists (
    select 1 from public.medals m
    where m.user_id = p.id and m.day >= '2026-07-29'
  );

-- ── 2. All-time sweep boards start at the epoch ──────────────────────────────
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
