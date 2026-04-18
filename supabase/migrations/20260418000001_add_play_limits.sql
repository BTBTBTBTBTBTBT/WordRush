-- Play-limit tracking for free users.
-- Moved from localStorage to the DB so the daily mode cap and VS match
-- cap can't be bypassed by clearing site data, using incognito, or
-- switching browsers.
--
-- Two kinds of entries share this table:
--   * kind = 'mode' → rows per (user_id, day, mode_id) marking that the
--     user used their one-free-play on that mode that day.
--   * kind = 'vs'   → rows per (user_id, day) counting VS matches
--     started that day (count column); unique per day.

create table if not exists public.play_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null, -- YYYY-MM-DD, user's LOCAL day
  kind text not null check (kind in ('mode', 'vs')),
  mode_id text, -- populated when kind = 'mode'
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A user can only have one "mode cap used" row per (day, mode_id), and
-- one aggregate 'vs' counter row per day.
create unique index if not exists play_limits_mode_unique
  on public.play_limits (user_id, day, mode_id)
  where kind = 'mode';

create unique index if not exists play_limits_vs_unique
  on public.play_limits (user_id, day)
  where kind = 'vs';

-- Lookup by (user_id, day) is the hot path on the home screen.
create index if not exists play_limits_user_day_idx
  on public.play_limits (user_id, day);

alter table public.play_limits enable row level security;

create policy "Users read their own play limits"
  on public.play_limits for select
  using (auth.uid() = user_id);

create policy "Users write their own play limits"
  on public.play_limits for insert
  with check (auth.uid() = user_id);

create policy "Users update their own play limits"
  on public.play_limits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
