-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql), same
-- pattern as 20260603000004_lock_pro_columns.sql. Idempotent — safe to re-run.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260723000001_medals_lockdown.sql
--   or paste into the Supabase dashboard SQL editor.
--
-- Purpose (RLS-hardening audit, 2026-07-23): close the two medal forgery
-- vectors that are lockable WITHOUT any client change:
--
--   1. profiles.gold_medals / silver_medals / bronze_medals — the podium
--      counters shown on profiles. Today the broad "update own profile" RLS
--      policy lets any authenticated client PATCH its own counters to any
--      value. The ONLY legitimate writer is the daily-medals cron
--      (apps/web/app/api/cron/daily-medals/route.ts, service role — bypasses
--      this trigger). Verified: no shipped client (web/iOS/Android
--      GameResultsService or MedalService) ever writes these columns, so
--      reverting client writes breaks nothing in the field.
--
--   2. medals INSERT — the policy allowed a client to insert ANY medal_type,
--      including competitive podium medals ('gold','silver','bronze'), which
--      pollute medal/leaderboard SELECTs. Shipped clients only ever insert
--      the self-achievement types ('streak_7','streak_30','streak_100',
--      'perfect') — web daily-service.ts, iOS MedalService.swift, Android
--      MedalService.kt all confirmed. Podium medals stay cron-only (service
--      role bypasses RLS), so tightening WITH CHECK to the achievement subset
--      breaks nothing in the field.
--
-- NOT touched here (needs server-authoritative RPC + new client builds first;
-- see bible entry): profiles progression columns (total_wins/streaks/xp/...),
-- play_limits enforcement, all_time_records / user_stats value authority.

-- 1. Extend the existing profiles guard trigger: also revert podium-medal
--    counter writes from the two PostgREST client roles. Admins included —
--    no client feature writes these; the cron is service-role and unaffected.
create or replace function public.protect_pro_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the two PostgREST client roles are restricted. 'service_role'
  -- (webhooks, daily-medals cron), direct DB connections (auth.role() is null
  -- — dashboard/psql), and any other role pass through untouched.
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'anon' then
    return new;
  end if;

  -- Client write. Never let a client change admin or ban status — this is what
  -- makes the admin bypass below safe (no self-promotion → no forged Pro).
  new.is_admin  := old.is_admin;
  new.is_banned := old.is_banned;

  -- Podium-medal counters are cron-authored only; client writes are reverted
  -- for everyone (admins too — Simulate Pro doesn't touch medals).
  new.gold_medals   := old.gold_medals;
  new.silver_medals := old.silver_medals;
  new.bronze_medals := old.bronze_medals;

  -- Paid-access columns: an EXISTING admin keeps the in-app Simulate Pro toggle;
  -- every other client has these writes reverted (closes the free-Pro hole).
  if not coalesce(old.is_admin, false) then
    new.is_pro         := old.is_pro;
    new.pro_expires_at := old.pro_expires_at;
  end if;

  return new;
end;
$$;

-- (Trigger itself already exists from 20260603000004; recreate defensively so
-- this file also works on a fresh environment.)
drop trigger if exists protect_pro_columns_trg on public.profiles;
create trigger protect_pro_columns_trg
  before update on public.profiles
  for each row execute function public.protect_pro_columns();

-- 2. Tighten the medals INSERT policy: clients may only insert the
--    self-achievement medal types. Podium medals ('gold','silver','bronze')
--    become service-role-only (the cron), matching how they are awarded today.
drop policy if exists "Users insert own medals" on public.medals;
drop policy if exists "Users insert own achievement medals" on public.medals;
create policy "Users insert own achievement medals"
  on public.medals for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and medal_type in ('streak_7', 'streak_30', 'streak_100', 'perfect')
  );
