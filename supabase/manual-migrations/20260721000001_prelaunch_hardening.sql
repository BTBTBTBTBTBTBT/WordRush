-- ============================================================================
-- PRE-LAUNCH HARDENING (2026-07-21 security/UGC audit) — apply by hand in the
-- Supabase dashboard SQL editor (no CLI auth on this machine).
--
-- A. Score-injection mitigations (audit: CRITICAL/HIGH)
--    A1. daily_results: value sanity + no-future-day trigger (client roles)
--    A2. daily_seeds: canonical-shape trigger — the seed string is FORCED to
--        'daily-<day>-<mode>' so a client can no longer pre-insert a chosen
--        seed for a future day (= choosing the daily word in advance)
--    A3. matches: INSERT limited to player1_id = auth.uid() (no authoring rows
--        into another user's history) + time/score sanity trigger
-- B. UGC compliance (App Review 1.2)
--    B1. reports table (report a user; insert-own, no client SELECT)
--    B2. blocks table (block a user; own-rows CRUD)
--    B3. profiles username/bio content guard (charset + slur + reserved names)
--
-- All triggers gate on auth.role() like protect_pro_columns: service_role and
-- direct DB connections pass through untouched; only 'authenticated'/'anon'
-- PostgREST writes are constrained. Existing rows are never revalidated.
-- ============================================================================

-- A1 ─ daily_results sanity ───────────────────────────────────────────────────
create or replace function public.guard_daily_results()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  if new.day > (now() at time zone 'utc')::date + 1 then
    raise exception 'daily_results: future day';
  end if;
  if new.guess_count < 0 or new.guess_count > 200
     or new.time_seconds < 0 or new.time_seconds > 172800
     or new.total_boards < 1 or new.total_boards > 16
     or new.boards_solved < 0 or new.boards_solved > new.total_boards
     or new.composite_score < 0 or new.composite_score > 100000
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

-- A2 ─ daily_seeds canonical shape ───────────────────────────────────────────
create or replace function public.guard_daily_seeds()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  -- The only legitimate client insert is the lazy first-fetch of a day's seed:
  -- deterministic string, empty solutions, day within the local-date spread.
  new.seed := 'daily-' || new.day || '-' || new.game_mode;
  new.solutions := '[]'::jsonb;
  if new.day > (now() at time zone 'utc')::date + 1
     or new.day < (now() at time zone 'utc')::date - 2 then
    raise exception 'daily_seeds: day out of range';
  end if;
  return new;
end $fn$;

drop trigger if exists guard_daily_seeds_trg on public.daily_seeds;
create trigger guard_daily_seeds_trg
  before insert or update on public.daily_seeds
  for each row execute function public.guard_daily_seeds();

-- A3 ─ matches: no cross-user authorship + sanity ────────────────────────────
-- Every legit client INSERT (web/iOS/Android solo + the designated VS writer)
-- sets player1_id = self. Recreating the policy closes the "forge rows into a
-- victim's history via player2_id membership" vector. UPDATE policy unchanged
-- (both VS participants may still update shared-row fields).
drop policy if exists "Users can insert matches they're part of" on public.matches;
create policy "Users can insert their own matches"
  on public.matches for insert
  with check (auth.uid() = player1_id);

create or replace function public.guard_matches()
returns trigger language plpgsql security definer as $fn$
begin
  if auth.role() is distinct from 'authenticated' and auth.role() is distinct from 'anon' then
    return new;
  end if;
  if new.player1_score < 0 or new.player1_score > 200
     or new.player1_time < 0 or new.player1_time > 172800
     or new.completed_at < new.started_at
     or new.completed_at > now() + interval '1 hour' then
    raise exception 'matches: value out of range';
  end if;
  return new;
end $fn$;

drop trigger if exists guard_matches_trg on public.matches;
create trigger guard_matches_trg
  before insert or update on public.matches
  for each row execute function public.guard_matches();

-- B1 ─ reports (App Review 1.2: report objectionable users) ──────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  context text not null default '' check (char_length(context) <= 200),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id and reporter_id <> reported_user_id);
-- No client SELECT/UPDATE/DELETE policies: reports are reviewed via the admin
-- dashboard (service role / direct connection only).
create index if not exists idx_reports_reported on public.reports(reported_user_id, created_at desc);

-- B2 ─ blocks (App Review 1.2: block users) ──────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "Users manage own blocks select" on public.blocks;
drop policy if exists "Users manage own blocks insert" on public.blocks;
drop policy if exists "Users manage own blocks delete" on public.blocks;
create policy "Users manage own blocks select"
  on public.blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "Users manage own blocks insert"
  on public.blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Users manage own blocks delete"
  on public.blocks for delete to authenticated using (auth.uid() = blocker_id);

-- B3 ─ username/bio content guard ────────────────────────────────────────────
-- UI validation is bypassable via PostgREST; this is the server-side floor.
-- Charset stays permissive (letters/digits/space/._-) so existing legit names
-- keep working; existing exotic names only fail on their NEXT change.
create or replace function public.guard_profile_content()
returns trigger language plpgsql security definer as $fn$
declare
  uname text;
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
    if uname ~ '(ADMIN|MODERATOR|WORDOCIOUS|SUPPORT|SYSTEM)' then
      raise exception 'username: reserved';
    end if;
    foreach slur in array array[
      'NIGGER','NIGGA','FAGGOT','FAGOT','TRANNY','WETBACK','CHINK','SPICK','SPIC',
      'KIKE','GOOK','DARKY','RETARD','COON','RAGHEAD','BEANER','PAKI'
    ] loop
      if replace(replace(replace(replace(uname,'0','O'),'1','I'),'3','E'),'4','A') like '%' || slur || '%' then
        raise exception 'username: not allowed';
      end if;
    end loop;
  end if;
  if new.bio is distinct from old.bio and new.bio is not null then
    foreach slur in array array[
      'NIGGER','NIGGA','FAGGOT','TRANNY','WETBACK','CHINK','KIKE','GOOK','BEANER'
    ] loop
      if upper(new.bio) like '%' || slur || '%' then
        raise exception 'bio: not allowed';
      end if;
    end loop;
  end if;
  return new;
end $fn$;

drop trigger if exists guard_profile_content_trg on public.profiles;
create trigger guard_profile_content_trg
  before update on public.profiles
  for each row execute function public.guard_profile_content();

-- ── verification ─────────────────────────────────────────────────────────────
select tgname, tgrelid::regclass from pg_trigger
 where tgname in ('guard_daily_results_trg','guard_daily_seeds_trg','guard_matches_trg','guard_profile_content_trg');
select polname, polcmd from pg_policy where polrelid in ('public.reports'::regclass, 'public.blocks'::regclass, 'public.matches'::regclass);
