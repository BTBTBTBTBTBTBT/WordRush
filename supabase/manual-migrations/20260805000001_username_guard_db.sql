-- Username guard, round 2 — supersedes 20260730000001_username_profanity.sql.
--
-- 2026-07-31: a tester renamed himself "DamnDickCockBallsAss" from the Android
-- Edit Profile screen and it SAVED. Not a bypass — every rename path (all
-- three apps write profiles.username straight to PostgREST, sign-up goes
-- through handle_new_user) already reaches enforce_username_policy_trg. The
-- list was the hole: it targeted slurs + a handful of graphic terms and
-- deliberately excluded ALL milder profanity, so a name made entirely of
-- DAMN/DICK/COCK/BALLS/ASS matched nothing at any layer.
--
-- Policy now (mirrored in packages/core/src/username.ts and the Swift/Kotlin
-- ports; username.test.ts fails if this file and the TS module drift):
--   Tier 1 — slurs + strong profanity, matched as SUBSTRINGS of the collapsed
--     comparison form, after known-innocent carrier words (Scunthorpe,
--     Hitchcock, Dickens…) are stripped. Only terms whose collapsed form does
--     not occur inside innocent words belong here.
--   Tier 2 — mild-but-crude words that DO occur inside real names (ASS in
--     Cassandra, TIT in Titan, SEX in Essex): matched only as whole TOKENS.
--     Tokens are split at camelCase boundaries first, then at any non-letter,
--     so "Ass_Master" and "DamnDickCockBallsAss" both yield a bare ASS token
--     while "Cassandra" and "TitanFall" never do. A single lowercase run
--     ("damnballs") has no boundary and is accepted — the deliberate trade
--     against Scunthorpe-style false positives.
--
-- Existing rows are untouched (the trigger only screens CHANGED usernames);
-- the tester's current name is a moderation/cleanup decision, not this file's.

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
  tok text;
  -- Mirrors USERNAME_ALLOWED_CONTAINING. Removed from the name BEFORE the
  -- blocklist scan — the Scunthorpe problem. Stripping rather than exact-match
  -- allowlisting keeps compounds working: Scunthorpe_Fan passes, while
  -- ScunthorpeCUNT still fails because the bare term survives the strip.
  safes text[] := array[
    'SCUNTHORPE','PENISTONE','SHITAKE','SHIITAKE','LIGHTWATER',
    'CLITHEROE','ASSASSIN','ASSISI','COCKBURN','HANCOCK','BABCOCK',
    'MATSUSHITA','THERAPIST','ARSENAL','SUSSEX','MIDDLESEX','ESSEX',
    'DICKENS','DICKINSON','DICKSON','RIDDICK','PEACOCK','HITCHCOCK',
    'WOODCOCK','GAMECOCK','SHUTTLECOCK','COCKATOO','COCKPIT','COCKTAIL',
    'COCKER','HERACLITUS','ATWATER','SWANK'
  ];
  -- Tier 1 — mirrors USERNAME_BLOCKED_SUBSTRINGS in packages/core/src/username.ts.
  -- Substring-matched: do NOT add short/ambiguous terms here (ASS would reject
  -- "Cassandra"); those go in the token tier below.
  terms text[] := array[
    'NEGRO','NIGER','NIGGA','NIGGER','CHINK','SPICK','SPIC','KIKES','KIKE',
    'WETBACK','GOOKS','GOOK','DAGOS','DAGO','WOPS','COON','COONS',
    'TRANNY','TRANNIES','FAGGOT','FAGGY','FAGS','DYKES','DYKE',
    'RETARD','RETARDS','CRIPPLE','MONGOLOID','SHEMALE','HEEBS','HEEB',
    'PAKIS','PAKI','ABBOS','ABBO','SLANT','ZIPPERHEAD','RAGHEAD','TOWELHEAD',
    'CUNT','FUCK','SHIT','PORN','RAPE','RAPIST','PEDO','PAEDO','NAZI','HITLER',
    'DICK','COCK','PENIS','PUSSY','BITCH','WANK','DILDO','WHORE','SLUT',
    'CLIT','TWAT','JIZZ','BLOWJOB'
  ];
  -- Tier 2 — mirrors USERNAME_BLOCKED_TOKENS. Whole-token only.
  word_tokens text[] := array[
    'ASS','ARSE','ANAL','BALLS','DAMN','PISS','TIT','TITS',
    'BOOB','BOOBS','SEX'
  ];
  tokens text[];
begin
  -- Tier 1: substring scan on the collapsed form, carriers stripped first.
  foreach safe in array safes loop
    normalized := replace(normalized, public.normalize_username(safe), '');
  end loop;

  foreach term in array terms loop
    if position(public.normalize_username(term) in normalized) > 0 then
      return true;
    end if;
  end loop;

  -- Tier 2: token scan on the RAW name. camelCase boundaries become spaces,
  -- then anything non-alphabetic delimits. Mirrors usernameTokens() in
  -- packages/core/src/username.ts.
  tokens := regexp_split_to_array(
    upper(regexp_replace(raw, '([a-z])([A-Z])', '\1 \2', 'g')),
    '[^A-Z]+');
  foreach tok in array tokens loop
    if tok = any(word_tokens) then
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

-- Smoke checks (run manually after applying):
--   select public.username_is_offensive('DamnDickCockBallsAss'); -- true
--   select public.username_is_offensive('Ass_Master');           -- true
--   select public.username_is_offensive('BigD1ck69');            -- true
--   select public.username_is_offensive('Cassandra');            -- false
--   select public.username_is_offensive('Hitchcock_Fan');        -- false
--   select public.username_is_offensive('TitanFall');            -- false
