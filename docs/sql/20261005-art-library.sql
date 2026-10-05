-- Art Library (founder 10-05): the private design-art store behind admin > Content & Ops > Art Library.
-- APPLIED: 2026-10-05 10:27 CT to production (backup 20261005T152635Z). Read back: RLS on, 2 admin policies, bucket private.
--
-- Source of truth = the private GitHub repo BTBTBTBTBTBTBT/wordocious-art (manifest.json). Its sync.mjs uploads
-- changed files to the PRIVATE storage bucket `art-library` (by sha256) and upserts one art_assets row per file.
-- Decisions (approve / reject / shipped + note) are made in the admin page and live only here; sync.mjs never
-- overwrites status/decided_* on an existing row unless the manifest says `shipped`.
--
-- Access: admins only. The web admin API reads/writes with the service role (server side); RLS below also lets an
-- admin's own session read/write, and nobody else. Players see nothing (no grants beyond RLS, private bucket,
-- no storage policies for anon/authenticated).

create table if not exists public.art_assets (
  id          text primary key,                  -- repo path without extension, e.g. seasons/halloween/cast/w-alt1
  path        text not null unique,              -- repo path with extension = object key in bucket art-library
  type        text not null,                     -- top-level folder: characters, seasons, titles, buttons, ...
  kind        text,                              -- subfolder kind: hero, cast, titles, props, raw, skins, player ...
  season      text,
  character   text,                              -- cast id: w, o1, o2, o3, r, d, i, c, u, s
  status      text not null default 'draft'
              check (status in ('draft', 'approved', 'rejected', 'shipped')),
  title       text not null,
  caption     text,
  width       integer,
  height      integer,
  mime        text not null,
  bytes       integer not null default 0,
  sha256      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_by  uuid references public.profiles(id) on delete set null,
  decided_at  timestamptz,
  note        text
);

create index if not exists art_assets_type_idx      on public.art_assets (type);
create index if not exists art_assets_status_idx    on public.art_assets (status);
create index if not exists art_assets_season_idx    on public.art_assets (season) where season is not null;
create index if not exists art_assets_created_idx   on public.art_assets (created_at desc);

alter table public.art_assets enable row level security;

drop policy if exists art_assets_admin_select on public.art_assets;
drop policy if exists art_assets_admin_write  on public.art_assets;

-- Same admin test the app uses: profiles.role = 'admin' (verifyAdmin / middleware) or the is_admin flag.
create policy art_assets_admin_select on public.art_assets
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))));

create policy art_assets_admin_write on public.art_assets
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and (p.role = 'admin' or coalesce(p.is_admin, false))));

revoke all on public.art_assets from anon;

-- Private bucket. No storage.objects policies are added: only the service role (admin API + sync.mjs) can read or
-- write it, and the admin page gets short-lived signed URLs from /api/admin/art/sign.
insert into storage.buckets (id, name, public, file_size_limit)
values ('art-library', 'art-library', false, 52428800)
on conflict (id) do update set public = false;
