-- ⚠️ DO NOT APPLY YET — see the release gate below.
--
-- Removes the client's ability to write daily_bonuses. That row IS the all-time
-- sweep leaderboard (alltime_sweep_leaderboard ranks by counting rows with
-- sweep_awarded = true), so a client that can write the flag can award itself
-- sweeps for days it never played. Granting moved to the server in
-- apps/web/app/api/daily/award-bonuses, which recomputes the award from
-- daily_results using the service role.
--
-- ── RELEASE GATE ────────────────────────────────────────────────────────────
-- Every SHIPPED client writes this table directly:
--   * iOS 1.0 build 133 — LIVE on the App Store
--   * iOS 1.1 build 136 — TestFlight
--   * Android          — no Play build yet
-- Applying this before those are replaced would silently stop sweep/flawless
-- bonuses for everyone still on them: the upsert fails RLS, the XP is never
-- granted, and the all-time board stops recording their sweeps. The web app is
-- already on the endpoint (it updates instantly).
--
-- Apply only once BOTH are true:
--   1. An iOS build containing the server-side award is live in the App Store,
--   2. and adoption is high enough that you accept older builds losing bonuses.
-- Until then the exploit remains open — a deliberate trade, because breaking
-- real players' sweeps today is worse than a leaderboard nobody has attacked.
--
-- Verify before applying (should return only rows the server itself wrote):
--   select day, sweep_awarded, updated_at from daily_bonuses
--    order by updated_at desc limit 20;

alter table public.daily_bonuses enable row level security;

drop policy if exists "Users insert own daily bonuses"  on public.daily_bonuses;
drop policy if exists "Users update own daily bonuses"  on public.daily_bonuses;
drop policy if exists "daily_bonuses_insert_own"        on public.daily_bonuses;
drop policy if exists "daily_bonuses_update_own"        on public.daily_bonuses;

-- Reading stays open: the profile, records and sweep views all select from here.
-- (SELECT policies are intentionally left untouched.)
--
-- With no INSERT/UPDATE policy, the only writer left is the service role, which
-- bypasses RLS — exactly the stance push_subscriptions and referrals already take.
