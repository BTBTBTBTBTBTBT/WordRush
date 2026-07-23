-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent (create or replace) — safe to re-run.
--
-- BUG FIX (found 2026-07-23, on-device): guard_daily_results (prelaunch
-- hardening A1, 20260721000001) capped total_boards at 16. GAUNTLET is the
-- one mode whose run spans MORE than 16 boards — every platform records the
-- whole-run denominator of 21 (web gauntlet-game + iOS GameViewModel, "the
-- completion denominator is the WHOLE run's board count (all stages, 21)").
-- Result: every client GAUNTLET daily_results INSERT since 2026-07-21 raised
-- 'value out of range' and was silently dropped (clients swallow the error);
-- the home-grid W badge disappeared on the next server refetch even though
-- the local flow (results screens, flawless popup) looked correct.
--
-- Fix: raise the total_boards ceiling to 21 — the exact largest legitimate
-- value (GAUNTLET). Everything else about the guard is unchanged.
create or replace function public.guard_daily_results()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  if new.day > (now() at time zone 'utc')::date + 1 then
    raise exception 'daily_results: future day';
  end if;
  -- total_boards ceiling is 21 = GAUNTLET's whole-run board count, the largest
  -- legitimate client value (all other modes are ≤ 8). Keep in sync with the
  -- gauntlet stage table (web components/gauntlet + iOS GauntletEngine).
  if new.guess_count < 0 or new.guess_count > 200
     or new.time_seconds < 0 or new.time_seconds > 172800
     or new.total_boards < 1 or new.total_boards > 21
     or new.boards_solved < 0 or new.boards_solved > new.total_boards
     or new.composite_score < 0 or new.composite_score > 100000
     or new.vs_wins < 0 or new.vs_losses < 0 or new.vs_games < 0
     or new.vs_games > 1000 or new.vs_wins + new.vs_losses > new.vs_games then
    raise exception 'daily_results: value out of range';
  end if;
  return new;
end $fn$;
