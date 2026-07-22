-- ============================================================================
-- SHARE EVENTS (2026-07-22, distribution memo: "measure share rate per
-- completed game from day one; it's our most important growth number").
-- Apply by hand in the Supabase dashboard SQL editor.
--
-- Insert-only analytics log. Guests (anon role) may log with user_id null;
-- signed-in users must log as themselves. No client SELECT — the Weekly Five
-- dashboard reads it via SQL editor / service role (scripts/weekly-five.sql).
-- ============================================================================

create table if not exists public.share_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  platform text not null check (platform in ('web','ios','android')),
  game_mode text not null default '' check (char_length(game_mode) <= 32),
  kind text not null check (kind in ('text','image','link_invite','other')),
  surface text not null default '' check (char_length(surface) <= 32),
  created_at timestamptz not null default now()
);

alter table public.share_events enable row level security;

drop policy if exists "Anyone can log share events" on public.share_events;
create policy "Anyone can log share events"
  on public.share_events for insert
  to authenticated, anon
  with check (user_id is null or user_id = auth.uid());

create index if not exists idx_share_events_created on public.share_events(created_at desc);
create index if not exists idx_share_events_user on public.share_events(user_id, created_at desc);

-- verification
select count(*) as share_events_ready from public.share_events;
