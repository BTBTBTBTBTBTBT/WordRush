-- Auto-create a profile row when a new auth user is created.
--
-- BUG: email signup failed with "new row violates row-level security policy for
-- table profiles". The client called auth.signUp() then inserted the profile
-- row itself — but with email confirmation ON, signUp returns no session, so the
-- client is still the `anon` role and the profiles INSERT policy
-- (TO authenticated WITH CHECK auth.uid() = id) blocks it. OAuth signups worked
-- only because they establish a session immediately.
--
-- FIX: create the profile via a SECURITY DEFINER trigger on auth.users (runs as
-- the table owner, bypassing RLS), using the username passed in signup metadata.
-- The clients now pass { data: { username } } to signUp and no longer insert the
-- row themselves.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    'Player' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  uname := left(uname, 20);
  if char_length(uname) < 3 then
    uname := 'Player' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, uname)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- username collision → append a short unique suffix
    insert into public.profiles (id, username)
    values (new.id, left(uname, 13) || '_' || substr(replace(new.id::text, '-', ''), 1, 6))
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing auth users missing a profile (e.g. signups that failed
-- the old RLS insert, leaving an orphaned auth user) get one now.
insert into public.profiles (id, username)
select u.id, 'Player' || substr(replace(u.id::text, '-', ''), 1, 8)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
