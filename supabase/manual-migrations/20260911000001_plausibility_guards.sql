-- §260: server-side plausibility guards. Scores are client-reported; the
-- client-side floors (web lib/plausibility.ts, iOS Plausibility.swift, Android
-- Plausibility.kt) stop honest bugs, this stops everything else. Same numbers
-- in all four places — change them together.
--
-- APPLY BY HAND in the Supabase dashboard SQL editor (project
-- eniiqqsxpmuyrspvepiw), like 20260603000004_lock_pro_columns.sql. Safe to
-- re-run. Existing rows are NOT touched — the integrity cron
-- (/api/cron/integrity) lists any that already violate the floor.

create or replace function public.daily_results_plausibility()
returns trigger
language plpgsql
as $$
begin
  if new.guess_count < 0 or new.time_seconds < 0 then
    raise exception 'daily_results: negative guess_count/time_seconds' using errcode = '23514';
  end if;
  if new.guess_count >= 200 or new.time_seconds >= 172800 or new.total_boards > 20 or new.total_boards < 1 then
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
  end if;
  return new;
end;
$$;

drop trigger if exists daily_results_plausibility_trg on public.daily_results;
create trigger daily_results_plausibility_trg
  before insert or update on public.daily_results
  for each row execute function public.daily_results_plausibility();

-- Records: a fastest_win under one second or a fewest_guesses under one is
-- not a record anyone set.
create or replace function public.all_time_records_plausibility()
returns trigger
language plpgsql
as $$
begin
  if new.record_type = 'fastest_win' and (new.record_value < 1 or new.record_value >= 172800) then
    raise exception 'all_time_records: implausible fastest_win %', new.record_value using errcode = '23514';
  end if;
  if new.record_type = 'fewest_guesses' and new.record_value < 1 then
    raise exception 'all_time_records: implausible fewest_guesses %', new.record_value using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists all_time_records_plausibility_trg on public.all_time_records;
create trigger all_time_records_plausibility_trg
  before insert or update on public.all_time_records
  for each row execute function public.all_time_records_plausibility();
