-- ============================================================================
-- THE WEEKLY FIVE (distribution memo) — paste any block into the Supabase SQL
-- editor. All derived from existing tables; share rate needs share_events
-- (manual-migration 20260722000001). Pro conversion/mix and ad revenue come
-- from the Stripe/ASC/AdMob dashboards, not SQL.
-- ============================================================================

-- 1. DAU (players who recorded any daily result or match, last 14 days)
select d::date as day, count(distinct user_id) as dau
from (
  select user_id, day::timestamptz as d from daily_results
  union all
  select player1_id, created_at from matches
  union all
  select player2_id, created_at from matches where player2_id is not null
) t
where d > now() - interval '14 days'
group by 1 order by 1 desc;

-- 2. D1 / D7 retention by signup cohort (last 30 signup days)
with first_seen as (
  select user_id, min(day) as cohort_day from daily_results group by 1
),
activity as (
  select distinct user_id, day from daily_results
)
select
  f.cohort_day,
  count(*) as cohort_size,
  round(100.0 * count(*) filter (where a1.user_id is not null) / count(*), 1) as d1_pct,
  round(100.0 * count(*) filter (where a7.user_id is not null) / count(*), 1) as d7_pct,
  round(100.0 * count(*) filter (where a30.user_id is not null) / count(*), 1) as d30_pct
from first_seen f
left join activity a1  on a1.user_id = f.user_id and a1.day = f.cohort_day + 1
left join activity a7  on a7.user_id = f.user_id and a7.day = f.cohort_day + 7
left join activity a30 on a30.user_id = f.user_id and a30.day = f.cohort_day + 30
where f.cohort_day > current_date - 30
group by 1 order by 1 desc;

-- 3. Share rate per completed game (last 14 days; requires share_events)
with games as (
  select day::date as d, count(*) as completed
  from daily_results where play_type = 'solo' and day > current_date - 14
  group by 1
),
shares as (
  select created_at::date as d, count(*) as shares,
         count(*) filter (where kind = 'image') as image_shares,
         count(*) filter (where kind = 'text') as text_shares
  from share_events where created_at > now() - interval '14 days'
  group by 1
)
select g.d as day, g.completed, coalesce(s.shares, 0) as shares,
       round(100.0 * coalesce(s.shares, 0) / nullif(g.completed, 0), 1) as share_rate_pct,
       coalesce(s.image_shares, 0) as image, coalesce(s.text_shares, 0) as text
from games g left join shares s on s.d = g.d
order by 1 desc;

-- 4. Pro conversion (web-visible portion; store subs via ASC/Play dashboards)
select
  count(*) filter (where is_pro) as active_pro,
  count(*) filter (where stripe_customer_id is not null) as web_customers,
  count(*) as total_profiles,
  round(100.0 * count(*) filter (where is_pro) / nullif(count(*), 0), 2) as pro_pct
from profiles;

-- 5. Reports filed (the quiet sixth number — moderation load)
select created_at::date as day, count(*) as reports
from reports where created_at > now() - interval '30 days'
group by 1 order by 1 desc;
