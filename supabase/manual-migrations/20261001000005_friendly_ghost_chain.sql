-- Friends pocket games: Ghost and Word Chain join (founder, 2026-10-01:
-- "I didn't see ghost and word chain on the play with friends games").
alter table public.friendly_games drop constraint if exists friendly_games_kind_check;
alter table public.friendly_games add constraint friendly_games_kind_check
  check (kind in ('rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'));
