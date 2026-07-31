-- ⚠️ MANUAL MIGRATION — apply by hand in the Supabase dashboard SQL editor.
-- Idempotent (if not exists everywhere) — safe to re-run.
--
-- Admin-visibility instrumentation (bible §199):
--   1. profiles.app_version / app_platform / last_seen_at — stamped by each
--      client at session start, so "how many users are still on 1.1" becomes
--      answerable. Additive + nullable: old clients simply never stamp.
--   2. profiles.converted_from_guest — stamped by the web client at the moment
--      a guest gains a session (the growth loop's guest→account conversion).
--   3. system_heartbeats — one row per cron job, upserted on every successful
--      run; the admin Ops page turns a stale heartbeat into a red flag.
--      Service-role only (RLS enabled, no policies), like store_webhook_events.

alter table public.profiles
  add column if not exists app_version text,
  add column if not exists app_platform text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists converted_from_guest boolean not null default false;

create table if not exists public.system_heartbeats (
  job         text primary key,
  last_run_at timestamptz not null default now(),
  ok          boolean not null default true,
  detail      text
);

alter table public.system_heartbeats enable row level security;
-- No policies → only the service role (which bypasses RLS) can read/write.

-- Verification
select column_name from information_schema.columns
 where table_name = 'profiles'
   and column_name in ('app_version','app_platform','last_seen_at','converted_from_guest');
select count(*) as heartbeats_table_exists from public.system_heartbeats;
