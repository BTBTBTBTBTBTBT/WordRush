-- APPLIED: 2026-10-05 14:03 CT to production (backup 20261005T190307Z). Read back: 8 tables RLS on, 0 policies, grants
-- postgres + service_role only (view social_open_feedback too), bucket social-media private, social_settings paused=false.
-- Seed: docs/sql/20261005-social-studio-seed.sql applied the same day (4 drafts Oct 7/9/11/14, 20 targets + links).
--
-- Social Studio (founder 10-05): marketing posts BMT and JP see ahead of time, approve / reject / comment, and that
-- publish automatically at their scheduled time once BOTH approve the current version.
-- Page: admin > Growth > Social Studio (/admin/studio). Rules: apps/web/lib/admin/studio.ts. Publisher:
-- /api/cron/social-publish (every 15 min). Adapters: apps/web/lib/social/adapters.ts.
--
-- Approvers = public.art_reviewers (BMT + JP), the same identity model as the Art Library.
-- social_reviews.version: an approval counts only for the post version it was given on. Any caption or image edit
-- bumps social_posts.version, so what posts is always exactly what both people saw.
-- social_feedback = notes Claude reads before the next drafting pass:  select * from public.social_open_feedback;
--
-- Access: EVERY table here is service-role only (RLS on, no policies, no anon/authenticated grants). The admin API
-- (verifyAdmin) and the cron use the service role server side. social_accounts holds OAuth tokens: never exposed.

create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                       -- internal name: 'Halloween cast teaser'
  kind          text not null default 'post',        -- 'cast', 'teaser', 'wotd', 'season', 'post'
  scheduled_at  timestamptz not null,
  hashtags      text[] not null default '{}',
  -- [{ "size": "portrait"|"pin"|"landscape", "src": "public"|"bucket", "path": "/social/seed/x.jpg" | "posts/<id>/x.jpg",
  --    "width": 1080, "height": 1350 }]
  media         jsonb not null default '[]'::jsonb,
  link_slug     text,                                -- marketing_links slug prefix for this post's tracked links
  link_target   text not null default 'https://wordocious.com/',
  version       integer not null default 1,          -- bumped by every caption / image edit
  edited_at     timestamptz,                         -- last content edit (the "Edited, needs re-approval" note)
  edited_by     uuid references public.profiles(id) on delete set null,
  paused        boolean not null default false,      -- hold just this post
  status        text not null default 'draft'
                check (status in ('draft', 'posted', 'partial', 'failed')),
  created_by    text not null default 'claude',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists social_posts_scheduled_idx on public.social_posts (scheduled_at);

create table if not exists public.social_post_targets (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.social_posts(id) on delete cascade,
  platform        text not null check (platform in ('instagram', 'facebook', 'threads', 'pinterest', 'x', 'tiktok')),
  caption         text not null default '',
  status          text not null default 'pending'
                  check (status in ('pending', 'posting', 'posted', 'failed', 'skipped')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at      timestamptz,                       -- set while a publisher run owns it (idempotency lock)
  remote_id       text,
  remote_url      text,
  last_error      text,
  posted_at       timestamptz,
  link_slug       text references public.marketing_links(slug) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (post_id, platform)
);

create index if not exists social_post_targets_due_idx on public.social_post_targets (status, next_attempt_at);

create table if not exists public.social_reviews (
  post_id     uuid not null references public.social_posts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision    text not null check (decision in ('approve', 'reject', 'changes')),
  version     integer not null,                      -- the post version this call was made on
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (post_id, reviewer_id)
);

create table if not exists public.social_feedback (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references public.social_posts(id) on delete set null,
  scope         text,                                -- 'week:2026-10-12', 'platform:x', 'voice:captions'
  author_id     uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) > 0),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_note text,
  constraint social_feedback_target_check check (post_id is not null or scope is not null)
);

create index if not exists social_feedback_post_idx on public.social_feedback (post_id) where post_id is not null;
create index if not exists social_feedback_open_idx on public.social_feedback (created_at desc) where resolved_at is null;

-- OAuth tokens. One row per platform. NEVER readable by any client role; never returned by the API.
create table if not exists public.social_accounts (
  platform       text primary key check (platform in ('instagram', 'facebook', 'threads', 'pinterest', 'x', 'tiktok')),
  account_id     text,                               -- IG user id / FB page id / Pinterest board id / X user id ...
  handle         text,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  scopes         text,
  meta           jsonb not null default '{}'::jsonb,
  connected_by   uuid references public.profiles(id) on delete set null,
  connected_at   timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);

-- Short-lived OAuth state (+ PKCE verifier) between Connect and the callback.
create table if not exists public.social_oauth_states (
  state          text primary key,
  provider       text not null,
  code_verifier  text,
  created_by     uuid references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now()
);

-- Global switches. One row, id = 1.
create table if not exists public.social_settings (
  id          integer primary key default 1 check (id = 1),
  paused      boolean not null default false,        -- "Pause all posting": the publisher skips everything
  paused_by   uuid references public.profiles(id) on delete set null,
  paused_at   timestamptz,
  updated_at  timestamptz not null default now()
);
insert into public.social_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.social_publish_log (
  id          bigint generated always as identity primary key,
  post_id     uuid references public.social_posts(id) on delete set null,
  target_id   uuid references public.social_post_targets(id) on delete set null,
  platform    text not null,
  attempt     integer not null,
  ok          boolean not null,
  remote_id   text,
  remote_url  text,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists social_publish_log_post_idx on public.social_publish_log (post_id, created_at desc);

alter table public.social_posts        enable row level security;
alter table public.social_post_targets enable row level security;
alter table public.social_reviews      enable row level security;
alter table public.social_feedback     enable row level security;
alter table public.social_accounts     enable row level security;
alter table public.social_oauth_states enable row level security;
alter table public.social_settings     enable row level security;
alter table public.social_publish_log  enable row level security;

revoke all on public.social_posts, public.social_post_targets, public.social_reviews, public.social_feedback,
              public.social_accounts, public.social_oauth_states, public.social_settings, public.social_publish_log
  from anon, authenticated;

-- Unresolved feedback, newest first: what Claude reads before the next drafting pass.
create or replace view public.social_open_feedback with (security_invoker = true) as
select f.id,
       f.post_id,
       sp.title        as post_title,
       sp.scheduled_at as post_scheduled_at,
       f.scope,
       p.username      as author,
       f.body,
       f.created_at
from public.social_feedback f
left join public.social_posts sp on sp.id = f.post_id
left join public.profiles     p  on p.id = f.author_id
where f.resolved_at is null
order by f.created_at desc;

revoke all on public.social_open_feedback from anon, authenticated;

-- Post images composed or uploaded later (ChatGPT art) live here. Private: the admin page and the publisher use
-- short-lived signed URLs (the posting APIs fetch the image from that URL at publish time).
insert into storage.buckets (id, name, public, file_size_limit)
values ('social-media', 'social-media', false, 20971520)
on conflict (id) do update set public = false;
