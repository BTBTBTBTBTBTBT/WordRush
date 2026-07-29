-- ⚠️ MANUAL MIGRATION — APPLIED by hand 2026-07-29 (dashboard SQL editor).
--
-- Backfills the missing SQL definition for push_subscriptions: the table was
-- referenced by apps/web/app/api/push/{subscribe,unsubscribe}/route.ts and
-- cron/daily-reminder since web push shipped, but no migration ever created
-- it — every notification toggle on the website 500'd silently until the
-- 2026-07-29 prod audit caught it (bible §170).
--
-- Service-role only (RLS enabled, no policies): all reads/writes go through
-- the API routes with the admin client; the endpoint/keys pair is
-- per-browser credential-ish material no other client needs to see.

create table public.push_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
