-- Art Library: two-approver reviews + a feedback thread Claude can read (founder 10-05).
-- APPLIED: 2026-10-05 11:09 CT to production (backup 20261005T160854Z). Read back: 3 tables with RLS on, 3 admin
-- policies, view art_open_feedback security_invoker=true (only postgres + service_role hold grants), art_reviewers =
-- BMT (username BMT) + JP (username JPGolf), 0 reviews / 0 feedback rows.
--
-- art_reviewers = who must approve (BMT + JP). art_reviews = one row per (asset, reviewer), latest decision wins
-- (the admin API upserts). An asset becomes 'approved' only when EVERY art_reviewers row has 'approve'; any
-- 'reject' makes it 'rejected'; any 'changes' keeps it 'draft'. 'shipped' is only ever set or cleared by the
-- decide route (Mark shipped / Back to draft). The rule lives in apps/web/lib/admin/art-library.ts
-- (reviewStatus) and is applied by POST /api/admin/art/review, which writes art_assets.status / decided_at.
--
-- art_feedback = free-text notes on one asset (asset_id) or on a whole area (scope, e.g. 'season:halloween',
-- 'surface:leaderboard'). Claude reads the unresolved ones with:  select * from public.art_open_feedback;
--
-- Access: admins only, same test as art_assets (the web admin API uses the service role server side).

create table if not exists public.art_reviewers (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  short_name  text not null unique,              -- what the page says: 'Waiting on JP'
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.art_reviews (
  asset_id    text not null references public.art_assets(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision    text not null check (decision in ('approve', 'reject', 'changes')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (asset_id, reviewer_id)
);

create index if not exists art_reviews_reviewer_idx on public.art_reviews (reviewer_id);

create table if not exists public.art_feedback (
  id            uuid primary key default gen_random_uuid(),
  asset_id      text references public.art_assets(id) on delete set null,
  scope         text,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (length(btrim(body)) > 0),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_note text,
  constraint art_feedback_target_check check (asset_id is not null or scope is not null)
);

create index if not exists art_feedback_asset_idx on public.art_feedback (asset_id) where asset_id is not null;
create index if not exists art_feedback_scope_idx on public.art_feedback (scope) where scope is not null;
create index if not exists art_feedback_open_idx  on public.art_feedback (created_at desc) where resolved_at is null;

alter table public.art_reviewers enable row level security;
alter table public.art_reviews   enable row level security;
alter table public.art_feedback  enable row level security;

drop policy if exists art_reviewers_admin_all on public.art_reviewers;
drop policy if exists art_reviews_admin_all   on public.art_reviews;
drop policy if exists art_feedback_admin_all  on public.art_feedback;

-- Same admin test as art_assets: profiles.role = 'admin' or the is_admin flag.
create policy art_reviewers_admin_all on public.art_reviewers
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))));

create policy art_reviews_admin_all on public.art_reviews
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))));

create policy art_feedback_admin_all on public.art_feedback
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))));

revoke all on public.art_reviewers from anon;
revoke all on public.art_reviews   from anon;
revoke all on public.art_feedback  from anon;

-- Unresolved feedback, newest first: what Claude reads before an art pass.
create or replace view public.art_open_feedback with (security_invoker = true) as
select f.id,
       f.asset_id,
       a.path   as asset_path,
       a.title  as asset_title,
       a.season as asset_season,
       f.scope,
       p.username as author,
       f.body,
       f.created_at
from public.art_feedback f
left join public.art_assets a on a.id = f.asset_id
left join public.profiles  p on p.id = f.author_id
where f.resolved_at is null
order by f.created_at desc;

-- Admins read it through the service-role API; Claude reads it with psql. No client role needs it.
revoke all on public.art_open_feedback from anon, authenticated;

-- The two approvers (looked up by username so the file stays readable).
insert into public.art_reviewers (profile_id, short_name, sort)
select id, 'BMT', 1 from public.profiles where username = 'BMT'
on conflict (profile_id) do update set short_name = excluded.short_name, sort = excluded.sort;

insert into public.art_reviewers (profile_id, short_name, sort)
select id, 'JP', 2 from public.profiles where username = 'JPGolf'
on conflict (profile_id) do update set short_name = excluded.short_name, sort = excluded.sort;

do $$
begin
  if (select count(*) from public.art_reviewers) <> 2 then
    raise exception 'expected 2 art_reviewers (BMT, JPGolf), found %', (select count(*) from public.art_reviewers);
  end if;
end $$;
