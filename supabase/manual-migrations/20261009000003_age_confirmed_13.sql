-- 2.8 item 29: Wordocious is 13+. Server side of the neutral age check.
--
-- Apply (Opus): scripts/db-backup.sh, then psql "$(cat ~/.wordocious-db-url)" -f this file, read back.
--
-- profiles gets:
--   age_confirmed_13   boolean  — true once the player passed the age check (default false: every
--                                 EXISTING account is asked once on its next launch)
--   (no birth year is stored: profiles are readable by other players for leaderboards — Opus 10-09)
--   age_under13_at     timestamptz — set when an existing account answered "under 13": the account is
--                                 signed out and purged by /api/cron/purge-under13 after 7 days
--
-- RLS / trigger: clients (authenticated / anon) can NEVER write these columns — only the service role
-- (POST /api/account/age, which re-validates the year server-side) and direct DB connections can.
-- So the flag is not user-writable at all, once set or before.

alter table public.profiles
  add column if not exists age_confirmed_13 boolean not null default false,
  add column if not exists age_under13_at   timestamptz;

create or replace function public.protect_age_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the two PostgREST client roles are restricted (service_role + dashboard/psql pass through).
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'anon' then
    return new;
  end if;
  new.age_confirmed_13 := old.age_confirmed_13;
  new.age_under13_at   := old.age_under13_at;
  return new;
end;
$$;

drop trigger if exists protect_age_columns_trg on public.profiles;
create trigger protect_age_columns_trg
  before update on public.profiles
  for each row execute function public.protect_age_columns();

-- A brand-new profile row must also start unconfirmed whatever the client sends on insert.
create or replace function public.protect_age_columns_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'anon' then
    return new;
  end if;
  new.age_confirmed_13 := false;
  new.age_under13_at   := null;
  return new;
end;
$$;

drop trigger if exists protect_age_columns_insert_trg on public.profiles;
create trigger protect_age_columns_insert_trg
  before insert on public.profiles
  for each row execute function public.protect_age_columns_insert();

create index if not exists profiles_age_under13_idx
  on public.profiles (age_under13_at) where age_under13_at is not null;

-- Read back:
--   select count(*) filter (where age_confirmed_13) as confirmed,
--          count(*) filter (where age_under13_at is not null) as under13, count(*) from public.profiles;
-- The 'age_check' off-switch row already exists in app_flags (20261009000001).
-- STRICTER LATER (optional; breaks 2.7.1 sign-ups so only after old versions age out): reject new
-- auth.users rows whose raw_user_meta_data lacks age_confirmed_13.
