-- VS overhaul (founder, 2026-10-01): async friend challenges, "race my run".
-- The challenger plays a fresh VS puzzle first; their run is stored here; each
-- invited friend (or anyone with the link) races it later on the same seed,
-- against a ghost that replays the challenger's pace. Results are scored with
-- the live rule (packages/core vs-lobby.ts vsOutcome) and written as a normal
-- VS `matches` row, so head-to-head, Rivals and the Stats VS section all count
-- them like a live match.
--
-- Every read and write goes through /api/vs/challenges (service role), so the
-- tables carry RLS with read-own policies only.

create table if not exists public.vs_challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  challenger_id uuid not null references auth.users(id) on delete cascade,
  game_mode text not null,
  seed text not null,
  -- The challenger's run (the numbers a live match compares).
  solved boolean not null,
  boards_solved int not null default 0,
  total_boards int not null default 1,
  guesses int not null,
  time_ms int not null check (time_ms >= 0),
  guess_log text[] not null default '{}',
  solutions text[] not null default '{}',
  -- Who may race it: listed friends, and anyone with the code when is_link.
  invitee_ids uuid[] not null default '{}',
  is_link boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists vs_challenges_challenger_idx on public.vs_challenges (challenger_id, created_at desc);
create index if not exists vs_challenges_invitees_idx on public.vs_challenges using gin (invitee_ids);

create table if not exists public.vs_challenge_entries (
  challenge_id uuid not null references public.vs_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solved boolean not null,
  boards_solved int not null default 0,
  guesses int not null,
  time_ms int not null check (time_ms >= 0),
  guess_log text[] not null default '{}',
  -- From the racer's side.
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index if not exists vs_challenge_entries_user_idx on public.vs_challenge_entries (user_id, created_at desc);

alter table public.vs_challenges enable row level security;
alter table public.vs_challenge_entries enable row level security;

create policy "Challenger or invitee reads challenge"
  on public.vs_challenges for select
  using (auth.uid() = challenger_id or auth.uid() = any (invitee_ids));

create policy "Racer or challenger reads entry"
  on public.vs_challenge_entries for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.vs_challenges c where c.id = challenge_id and c.challenger_id = auth.uid())
  );
