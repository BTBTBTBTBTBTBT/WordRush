-- 2.8 item 9b: live pocket games. NOT YET APPLIED (Opus applies: db-backup.sh, then psql, then read back).
--
-- The move route broadcasts the accepted move on Realtime channel fg:<gameId> (REST broadcast with the
-- service key, nothing to configure). This table is the BACKUP path: the server bumps one tiny row per
-- game on every save, clients subscribe with postgres_changes (filter game_id=eq.<id>) and refetch the
-- game through the API when the revision moves. It carries a revision only. It deliberately does NOT
-- carry game state: friendly_games itself is not published to Realtime, because its row holds the Pass
-- the Puzzle answer and an open Rock Paper Scissors pick.
--
-- Writer: server only (service role). Readers: the two players (RLS), so a subscriber only ever hears
-- about their own games.

create table if not exists public.friendly_game_pings (
  game_id uuid primary key references public.friendly_games(id) on delete cascade,
  player_a uuid not null references auth.users(id) on delete cascade,
  player_b uuid not null references auth.users(id) on delete cascade,
  rev bigint not null default 1,
  status text not null default 'active',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.friendly_game_pings enable row level security;

drop policy if exists "Players hear their games" on public.friendly_game_pings;
create policy "Players hear their games"
  on public.friendly_game_pings for select
  using (auth.uid() = player_a or auth.uid() = player_b);

-- Realtime: publish the table (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendly_game_pings'
  ) then
    alter publication supabase_realtime add table public.friendly_game_pings;
  end if;
end $$;

-- Bump helper: insert-or-increment in one statement (the route calls this through rpc).
create or replace function public.bump_friendly_game_ping(p_game uuid, p_a uuid, p_b uuid, p_status text, p_by uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.friendly_game_pings as p (game_id, player_a, player_b, rev, status, updated_by, updated_at)
  values (p_game, p_a, p_b, 1, p_status, p_by, now())
  on conflict (game_id) do update
    set rev = p.rev + 1, status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
  returning rev;
$$;

revoke all on function public.bump_friendly_game_ping(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.bump_friendly_game_ping(uuid, uuid, uuid, text, uuid) to service_role;

-- Pings for games that are long over are dead weight; the FK cascade cleans them when the game goes.
