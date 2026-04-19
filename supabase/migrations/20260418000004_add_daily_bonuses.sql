-- One-shot daily bonus awards: Daily Sweep (completed all 7 dailies in
-- a single day) and Flawless Victory (won all 7). The server checks
-- this table on every daily completion and awards bonus XP + an
-- achievement the first time the criterion is met on a given day.
-- Unique (user_id, day) ensures each bonus can only fire once per day
-- even if the client double-submits.

create table if not exists public.daily_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null, -- YYYY-MM-DD, user's LOCAL day (matches daily_results.day)
  sweep_awarded boolean not null default false,
  flawless_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_bonuses_user_day_idx
  on public.daily_bonuses (user_id, day);

create index if not exists daily_bonuses_user_flags_idx
  on public.daily_bonuses (user_id)
  where sweep_awarded = true or flawless_awarded = true;

alter table public.daily_bonuses enable row level security;

create policy "Users read their own daily bonuses"
  on public.daily_bonuses for select
  using (auth.uid() = user_id);

create policy "Users write their own daily bonuses"
  on public.daily_bonuses for insert
  with check (auth.uid() = user_id);

create policy "Users update their own daily bonuses"
  on public.daily_bonuses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
