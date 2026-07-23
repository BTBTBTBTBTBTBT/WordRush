-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent (create or replace) — safe to re-run.
--
-- Guard-precision fixes from the 2026-07-23 boundary audit ("can an honest
-- client be rejected?" — the class the gauntlet total_boards bug proved out).
-- Three server-side fixes, no client change needed:
--
--   1. guard_profile_content: substring matching had a Scunthorpe problem —
--      it rejected Badminton (ADMIN), Systematic/Ecosystem (SYSTEM),
--      Supporter (SUPPORT), Raccoon/Tycoon (COON), Spicy/Spice (SPIC),
--      Gobbledygook (GOOK), and the bio idiom "chink in the armor".
--      Ambiguous terms now match on WORD BOUNDARIES (\m...\M); unambiguous
--      slurs stay substrings. Trade-off: an embedded slur inside a longer
--      word now passes the ambiguous list — reports/moderation remain the
--      backstop, and false-rejecting real players is the worse failure.
--
--   2. guard_matches: completed_at > now()+1h REJECTED every match row from
--      a device clock set >1h fast (auto-time off) — and the pending-record
--      retry re-stamps from the same clock, so it failed every drain and was
--      silently dropped after 7 days. Future timestamps are now CLAMPED to
--      now() instead (started_at ordering check kept). player1_time likewise
--      clamped at the 48h bound instead of rejected (persisted practice
--      timers can legitimately accumulate for weeks).
--
--   3. guard_daily_results: composite cap was one-size-fits-all (100000).
--      VS's formula legitimately reaches 105,050 at the allowed vs_games
--      volume (wins*100 + rate*50 + games*5, audit-derived) — over the cap,
--      same 16-vs-21 shape. Now split by play_type with audit-derived
--      ceilings + headroom: solo max legit is 3,072 (V2 DUEL_7 perfect) →
--      cap 10000 (also a big score-injection tightening from 100k); vs cap
--      120000. time_seconds clamped at 48h instead of rejected (same
--      persisted-timer rationale as matches).
--      KEEP IN SYNC: if scoring formulas change, re-derive these ceilings
--      (apps/web/lib/composite-scoring.ts + calculateVsCompositeScore).

-- 1 ─ username/bio content guard: word-boundary matching for ambiguous terms
create or replace function public.guard_profile_content()
returns trigger language plpgsql security definer as $fn$
declare
  uname text;
  folded text;
  slur text;
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  if new.username is distinct from old.username then
    uname := upper(coalesce(new.username, ''));
    if new.username !~ '^[A-Za-z0-9 ._-]{3,20}$' then
      raise exception 'username: invalid characters or length';
    end if;
    -- Reserved: whole words only (Badminton/Systematic/Supporter are fine).
    -- WORDOCIOUS stays a substring — no legit word contains it.
    if uname ~ '\m(ADMIN|MODERATOR|SUPPORT|SYSTEM)\M' or uname like '%WORDOCIOUS%' then
      raise exception 'username: reserved';
    end if;
    folded := replace(replace(replace(replace(uname,'0','O'),'1','I'),'3','E'),'4','A');
    -- Unambiguous slurs: substring match (no legit word contains these).
    foreach slur in array array[
      'NIGGER','NIGGA','FAGGOT','FAGOT','TRANNY','WETBACK','KIKE','RAGHEAD','BEANER'
    ] loop
      if folded like '%' || slur || '%' then
        raise exception 'username: not allowed';
      end if;
    end loop;
    -- Ambiguous terms (real words contain them): whole-word match only —
    -- Raccoon/Tycoon (COON), Spicy (SPIC), Gobbledygook (GOOK), Chink-in-…,
    -- Darkyard (DARKY), Pakistani names contain PAKI as a prefix… whole word.
    if folded ~ '\m(CHINK|SPICK|SPIC|GOOK|DARKY|RETARD|COON|PAKI)\M' then
      raise exception 'username: not allowed';
    end if;
  end if;
  if new.bio is distinct from old.bio and new.bio is not null then
    foreach slur in array array[
      'NIGGER','NIGGA','FAGGOT','TRANNY','WETBACK','KIKE','BEANER'
    ] loop
      if upper(new.bio) like '%' || slur || '%' then
        raise exception 'bio: not allowed';
      end if;
    end loop;
    if upper(new.bio) ~ '\m(CHINK|GOOK)\M' and upper(new.bio) !~ 'CHINK IN THE ARMOR' then
      raise exception 'bio: not allowed';
    end if;
  end if;
  return new;
end $fn$;

-- (Trigger already exists; recreate defensively for fresh environments.)
drop trigger if exists guard_profile_content_trg on public.profiles;
create trigger guard_profile_content_trg
  before update on public.profiles
  for each row execute function public.guard_profile_content();

-- 2 ─ matches: clamp fast-clock timestamps instead of rejecting the row
create or replace function public.guard_matches()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  -- Device clocks can be legitimately fast (auto-time off): clamp, don't drop.
  -- All comparisons NULL-safe: an in-progress row's NULL timestamps/values
  -- pass through untouched (least(NULL, x) would return x — never apply it).
  if new.completed_at > now() then
    new.completed_at := now();
  end if;
  if new.started_at > new.completed_at then
    new.started_at := new.completed_at;
  end if;
  if new.player1_time is not null then
    new.player1_time := least(new.player1_time, 172800);
  end if;
  if new.player1_score < 0 or new.player1_score > 200 or new.player1_time < 0 then
    raise exception 'matches: value out of range';
  end if;
  return new;
end $fn$;

drop trigger if exists guard_matches_trg on public.matches;
create trigger guard_matches_trg
  before insert or update on public.matches
  for each row execute function public.guard_matches();

-- 3 ─ daily_results: per-play_type composite ceilings + time clamp
create or replace function public.guard_daily_results()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  if new.day > (now() at time zone 'utc')::date + 1 then
    raise exception 'daily_results: future day';
  end if;
  -- Persisted practice/daily timers can legitimately accumulate: clamp at 48h.
  new.time_seconds := least(new.time_seconds, 172800);
  -- Ceilings are audit-derived legit maxima + headroom (2026-07-23):
  -- solo max = 3,072 (V2 DUEL_7 perfect win) → 10000;
  -- vs formula max at vs_games=1000 → 105,050 → 120000.
  if new.guess_count < 0 or new.guess_count > 200
     or new.time_seconds < 0
     or new.total_boards < 1 or new.total_boards > 21
     or new.boards_solved < 0 or new.boards_solved > new.total_boards
     or new.composite_score < 0
     or (new.play_type = 'solo' and new.composite_score > 10000)
     or (new.play_type = 'vs'   and new.composite_score > 120000)
     or new.vs_wins < 0 or new.vs_losses < 0 or new.vs_games < 0
     or new.vs_games > 1000 or new.vs_wins + new.vs_losses > new.vs_games then
    raise exception 'daily_results: value out of range';
  end if;
  return new;
end $fn$;

drop trigger if exists guard_daily_results_trg on public.daily_results;
create trigger guard_daily_results_trg
  before insert or update on public.daily_results
  for each row execute function public.guard_daily_results();
