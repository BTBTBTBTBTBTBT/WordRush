-- Add an is_admin flag so developer-only UI (e.g. the "Simulate Pro" test
-- toggle) renders ONLY for the developer — never for App Review or real users.
--
-- The Simulate Pro button writes profiles.is_pro client-side, so it was visible
-- (and tappable) by everyone, granting free Pro and risking an App Review
-- rejection. We keep the button (the dev relies on it for testing) but gate its
-- visibility on is_admin. This is a cosmetic visibility gate; is_pro itself is
-- already client-writable in this app's model, so no extra column lockdown is
-- needed here.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Flag the developer's account.
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'bterchin@gmail.com');
