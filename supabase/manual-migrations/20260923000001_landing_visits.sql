-- ============================================================================
-- LANDING VISITS (2026-09-23, JP: "show where the shares came from and what
-- the outcome was"). Apply by hand in the Supabase dashboard SQL editor.
--
-- Shares were counted going OUT (share_events) but nothing recorded a shared
-- link landing. This is the landing half: one row per real-browser visit to
--   * /s/<key>      — a shared result / leaderboard card   (page='share', ref=game mode)
--   * /join/<CODE>  — a referral gift invite               (page='join',  ref=referral code)
-- The admin Marketing page joins these to share_events / referrals /
-- profiles.signup_source to show opens, redemptions, and share-attributed
-- signups. Until this is applied, that page shows those cells as "tracking
-- from deploy" — the route treats a missing table as null, never 0.
--
-- Insert-only analytics log, same stance as share_events: anon + authenticated
-- may insert (the visitor is usually signed out), no client SELECT — the
-- service role reads it from api/admin/marketing. Social scrapers never run
-- the beacon, so unfurl fetches don't count. Safe to re-run.
-- ============================================================================

create table if not exists public.landing_visits (
  id uuid primary key default gen_random_uuid(),
  page text not null check (page in ('share','join')),
  ref text not null default '' check (char_length(ref) <= 64),
  created_at timestamptz not null default now()
);

alter table public.landing_visits enable row level security;

drop policy if exists "Anyone can log landing visits" on public.landing_visits;
create policy "Anyone can log landing visits"
  on public.landing_visits for insert
  to authenticated, anon
  with check (true);

create index if not exists idx_landing_visits_created on public.landing_visits(created_at desc);
create index if not exists idx_landing_visits_page_ref on public.landing_visits(page, ref);

-- verification
select count(*) as landing_visits_ready from public.landing_visits;
