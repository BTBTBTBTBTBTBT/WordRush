-- VS "ping me when someone's looking" (founder, 2026-10-01: knock out the
-- known issues). A Pro player who taps KEEP WAITING in the live queue pings
-- every opted-in Pro player (profiles.notification_prefs.vsLooking = true).
-- This table throttles both sides: a sender pings at most once per 10
-- minutes, a recipient hears at most once per 30. Service role only.

create table if not exists public.vs_looking_pings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz,
  last_received_at timestamptz
);

alter table public.vs_looking_pings enable row level security;
