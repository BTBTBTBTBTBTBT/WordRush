-- More Games §11: mode-aware plausibility floors for daily_results.
-- Supersedes the function body in 20260911000001_plausibility_guards.sql
-- (same generic rules, plus per-mode minimum winning guess_count and minimum
-- solve time). Same numbers as web lib/plausibility.ts, iOS Plausibility.swift
-- and Android Plausibility.kt — change them together.
--
-- APPLY BY HAND in the Supabase SQL editor (project eniiqqsxpmuyrspvepiw) at
-- Stage 8, AFTER the CHECK constraints admit the nine new game_mode keys and
-- BEFORE any More Games flag flips. `create or replace` only; the trigger
-- binding is unchanged. Safe to re-run. Existing rows are not touched — the
-- integrity cron lists any that already violate the floor.

create or replace function public.daily_results_plausibility()
returns trigger
language plpgsql
as $$
declare
  min_guesses int;
  min_seconds int;
begin
  if new.guess_count < 0 or new.time_seconds < 0 then
    raise exception 'daily_results: negative guess_count/time_seconds' using errcode = '23514';
  end if;
  if new.guess_count >= 200 or new.time_seconds >= 172800 or new.total_boards > 21 or new.total_boards < 1 then
    raise exception 'daily_results: out-of-range guess_count/time_seconds/total_boards' using errcode = '23514';
  end if;
  if new.completed then
    if new.guess_count < 1 then
      raise exception 'daily_results: a completed result needs at least one guess' using errcode = '23514';
    end if;
    -- every guess after the first costs at least one second
    if new.time_seconds < (new.guess_count - 1) then
      raise exception 'daily_results: % guesses in % seconds is not play', new.guess_count, new.time_seconds using errcode = '23514';
    end if;
    -- the perfect run is the lowest winning guess_count a mode can carry
    min_guesses := case new.game_mode
      when 'QUORDLE' then 4 when 'OCTORDLE' then 8 when 'SEQUENCE' then 4 when 'RESCUE' then 4 when 'GAUNTLET' then 21
      when 'SCRAMBLE' then 5 when 'GROUPS' then 4 when 'WORDSEARCH' then 10
      else 1 end;
    if new.guess_count < min_guesses then
      raise exception 'daily_results: % win with % guesses is below the perfect run (%)', new.game_mode, new.guess_count, min_guesses using errcode = '23514';
    end if;
    -- fewest seconds a human has ever needed to finish (More Games only; word modes keep the generic rule)
    min_seconds := case new.game_mode
      when 'SUDOKU' then 60 when 'REGIONS' then 15 when 'LADDER' then 8 when 'SCRAMBLE' then 12 when 'WORDSEARCH' then 15
      when 'CROSSWORD' then 25 when 'CRYPTOGRAM' then 15 when 'GROUPS' then 5 when 'HUB' then 8
      else 0 end;
    if new.time_seconds < min_seconds then
      raise exception 'daily_results: % win in % seconds is faster than possible (floor %)', new.game_mode, new.time_seconds, min_seconds using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Read-back: the trigger still points at this function.
-- select tgname, tgrelid::regclass from pg_trigger where tgname = 'daily_results_plausibility_trg';
