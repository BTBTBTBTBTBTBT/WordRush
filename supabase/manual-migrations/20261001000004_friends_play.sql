-- Friends overhaul (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md).
--
-- 1. "On now": clients heartbeat profiles.last_seen_at (existing column) every
--    minute while the app is open, plus last_activity = the db key of the game
--    on screen (e.g. 'DUEL', 'scramble'). A key, never free text: the friends
--    digest maps it to a title, and anything unknown reads as plain "On now".
-- 2. Pocket games (Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the
--    Puzzle): one row per match; the server is the only writer and runs the
--    rules (packages/core friendly-games.ts). `secret` holds Pass the Puzzle's
--    answer and is never sent to a client before the game ends.
-- 3. Moment reactions: a fixed emoji set on activity-feed moments.

alter table public.profiles add column if not exists last_activity text
  check (last_activity is null or last_activity ~ '^[A-Za-z0-9_]{1,24}$');

create table if not exists public.friendly_games (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rps', 'ttt', 'coin', 'pass')),
  player_a uuid not null references auth.users(id) on delete cascade,
  player_b uuid not null references auth.users(id) on delete cascade,
  state jsonb not null,
  secret text,
  status text not null default 'active' check (status in ('active', 'done', 'resigned', 'expired')),
  winner uuid references auth.users(id) on delete set null,
  a_seen_at timestamptz,
  b_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_a <> player_b)
);

create index if not exists friendly_games_a_idx on public.friendly_games (player_a, updated_at desc);
create index if not exists friendly_games_b_idx on public.friendly_games (player_b, updated_at desc);

alter table public.friendly_games enable row level security;

create policy "Players read their games"
  on public.friendly_games for select
  using (auth.uid() = player_a or auth.uid() = player_b);

create table if not exists public.moment_reactions (
  moment_id text not null check (char_length(moment_id) <= 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('clap', 'fire', 'wow', 'grr', 'rematch')),
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id, emoji)
);

create index if not exists moment_reactions_moment_idx on public.moment_reactions (moment_id);

alter table public.moment_reactions enable row level security;
