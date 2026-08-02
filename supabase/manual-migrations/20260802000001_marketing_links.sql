-- Marketing attribution substrate (applied via dashboard SQL editor).
--
-- 1. marketing_links — the /go/<slug> short links used in every social bio
--    and post. Clicks are counted server-side by the redirect route.
--    Service-role only (RLS on, no policies — the store_webhook_events stance).
-- 2. profiles.signup_source — first-touch attribution: the /go redirect drops
--    a 30-day cookie; the web app stamps it onto BRAND-NEW accounts only
--    (created within minutes), so existing players can never be mis-tagged.
--    "Signups by source" is the one marketing number that isn't vanity.

create table if not exists public.marketing_links (
  slug       text primary key,
  target     text not null,
  channel    text not null,
  clicks     integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.marketing_links enable row level security;

alter table public.profiles
  add column if not exists signup_source text;

-- Standard channel slugs, all landing on the home page for now (targets can
-- be repointed per-campaign later without changing any printed bio link).
insert into public.marketing_links (slug, target, channel) values
  ('tiktok',    'https://wordocious.com/', 'tiktok'),
  ('instagram', 'https://wordocious.com/', 'instagram'),
  ('x',         'https://wordocious.com/', 'x'),
  ('youtube',   'https://wordocious.com/', 'youtube'),
  ('threads',   'https://wordocious.com/', 'threads'),
  ('facebook',  'https://wordocious.com/', 'facebook'),
  ('pinterest', 'https://wordocious.com/', 'pinterest'),
  ('reddit',    'https://wordocious.com/', 'reddit')
on conflict (slug) do nothing;

-- Verification
select slug, channel from public.marketing_links order by slug;
select column_name from information_schema.columns
  where table_name = 'profiles' and column_name = 'signup_source';
