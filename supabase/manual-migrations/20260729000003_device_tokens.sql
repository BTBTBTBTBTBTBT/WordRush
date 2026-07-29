-- Remote-push groundwork: APNs (and later FCM) device tokens.
-- Clients upload their own token directly (see apps/ios PushRegistration.swift
-- upsert onConflict token), so RLS grants authenticated users insert/update/
-- delete of rows they own — unlike push_subscriptions, which is written only
-- through the web API with the service role.
-- The server send path (needs an APNs .p8 key) reads this with the service
-- role and is deferred; nothing consumes these rows yet.

create table if not exists public.device_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text primary key,
  created_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Owners manage their own tokens; upsert = insert + update, delete on sign-out.
create policy "device_tokens_select_own" on public.device_tokens
  for select using (auth.uid() = user_id);
create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (auth.uid() = user_id);
create policy "device_tokens_update_own" on public.device_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (auth.uid() = user_id);
