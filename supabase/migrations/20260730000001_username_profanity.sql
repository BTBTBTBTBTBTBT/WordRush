-- Username screening at the DATABASE, which is the only layer that counts.
--
-- Usernames render on every public leaderboard, on public profiles and in VS
-- callouts. Validation was length-only in all three apps and absent here, and
-- because profile updates go straight to PostgREST under RLS, an app-side
-- check is bypassable with a single curl:
--
--   curl -X PATCH '.../profiles?id=eq.<uid>' -d '{"username":"<slur>"}'
--
-- So the trigger below is the enforcement and the apps' copy
-- (packages/core/src/username.ts) is only there for a friendly message before
-- the round trip. username.test.ts fails if the two lists drift.

-- Fold a username to its comparison form: uppercase, leet substitutions
-- undone, non-letters dropped, repeated letters collapsed. Mirrors
-- normalizeUsername() in packages/core/src/username.ts.
create or replace function public.normalize_username(raw text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(upper(raw),
                '01!|34@5$7896+',
                'OIIIEAASSTBGGT'),
      '[^A-Z]', '', 'g'),
    '(.)\1+', '\1', 'g')
$$;

create or replace function public.username_is_offensive(raw text)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized text := public.normalize_username(raw);
  term text;
  safe text;
  -- Mirrors USERNAME_ALLOWED_CONTAINING. Removed from the name BEFORE the
  -- blocklist scan — the Scunthorpe problem. Stripping rather than exact-match
  -- allowlisting keeps compounds working: Scunthorpe_Fan passes, while
  -- ScunthorpeCUNT still fails because the bare term survives the strip.
  safes text[] := array[
    'SCUNTHORPE','PENISTONE','SHITAKE','SHIITAKE','LIGHTWATER',
    'CLITHEROE','ASSASSIN','ASSISI','COCKBURN','HANCOCK','BABCOCK',
    'MATSUSHITA','THERAPIST','ARSENAL','SUSSEX','MIDDLESEX','ESSEX'
  ];
  -- Mirrors USERNAME_BLOCKED_SUBSTRINGS in packages/core/src/username.ts.
  -- Every entry is 4+ characters and specific enough that no innocent English
  -- word contains it — do NOT add short terms here (ASS would reject
  -- "Cassandra", HELL would reject "Michelle").
  terms text[] := array[
    'NEGRO','NIGER','NIGGA','NIGGER','CHINK','SPICK','SPIC','KIKES','KIKE',
    'WETBACK','GOOKS','GOOK','DAGOS','DAGO','WOPS','COON','COONS',
    'TRANNY','TRANNIES','FAGGOT','FAGGY','FAGS','DYKES','DYKE',
    'RETARD','RETARDS','CRIPPLE','MONGOLOID','SHEMALE','HEEBS','HEEB',
    'PAKIS','PAKI','ABBOS','ABBO','SLANT','ZIPPERHEAD','RAGHEAD','TOWELHEAD',
    'CUNT','FUCK','SHIT','PORN','RAPE','RAPIST','PEDO','PAEDO','NAZI','HITLER'
  ];
begin
  foreach safe in array safes loop
    normalized := replace(normalized, public.normalize_username(safe), '');
  end loop;

  foreach term in array terms loop
    if position(public.normalize_username(term) in normalized) > 0 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.enforce_username_policy()
returns trigger
language plpgsql
as $$
begin
  -- Only screen when the username actually changes. Existing rows are left
  -- alone: a retro-active check would make every unrelated profile UPDATE
  -- (XP, streaks, avatar) fail for a user whose name predates this policy.
  -- Those are handled by moderation/reports, not by breaking their account.
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;

  if new.username is null then
    return new;
  end if;

  if length(btrim(new.username)) < 3 or length(btrim(new.username)) > 20 then
    raise exception 'Username must be 3-20 characters'
      using errcode = 'check_violation';
  end if;

  if new.username !~ '^[A-Za-z0-9 ._-]+$' then
    raise exception 'Username may use letters, numbers, spaces, and . _ - only'
      using errcode = 'check_violation';
  end if;

  if new.username !~ '[A-Za-z0-9]' then
    raise exception 'Username needs at least one letter or number'
      using errcode = 'check_violation';
  end if;

  if public.username_is_offensive(new.username) then
    -- Deliberately vague: telling the user which term matched is a hint for
    -- working around the filter.
    raise exception 'That username is not available. Please choose another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_username_policy_trg on public.profiles;
create trigger enforce_username_policy_trg
  before insert or update of username on public.profiles
  for each row execute function public.enforce_username_policy();

-- handle_new_user() is SECURITY DEFINER and inserts the profile row from
-- sign-up metadata, so a username chosen at sign-up reaches this trigger too:
-- BEFORE INSERT triggers fire regardless of the caller's privileges.
