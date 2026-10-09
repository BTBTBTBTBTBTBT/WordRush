-- 2.8 item 35: per-player game order (Dailies + Puzzles), synced across devices.
--
-- Apply (Opus): scripts/db-backup.sh, then psql "$(cat ~/.wordocious-db-url)" -f this file, read back.
--
-- profiles.game_order jsonb  { "dailies": ["practice", ...], "puzzles": ["sudoku", ...] } — catalog MODE IDS.
-- null = the default order. Display-only: sweep rules / db keys are untouched. Clients resolve it with
-- applyGameOrder (core game-order.ts; Swift GameOrder, Kotlin GameOrder): unknown ids dropped, new games
-- appended, Classic pinned first. The existing "update own profile" RLS policy already covers the column.
-- Guests keep the order in local storage only.
alter table public.profiles
  add column if not exists game_order jsonb;

-- Keep it small and the right shape (clients also sanitize).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_game_order_shape') then
    alter table public.profiles add constraint profiles_game_order_shape
      check (game_order is null or (jsonb_typeof(game_order) = 'object' and pg_column_size(game_order) < 2048));
  end if;
end $$;

notify pgrst, 'reload schema';

-- Read back:
--   select count(*) filter (where game_order is not null) as customized, count(*) from public.profiles;
