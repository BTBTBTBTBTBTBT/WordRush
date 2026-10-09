-- 2.8 item 5b/51 gating: the server-side owned-items ledger. NOT YET APPLIED (Opus applies: db-backup.sh, psql, read back).
-- Supersedes docs/sql/20261010-owned-items.sql (same table, plus granted_by + 'season' + the audit log).
--
-- One row = one player owns one mascot option, forever. item_key is the access-table key "<field>:<id>"
-- (packages/core/src/avatar-access.ts avatarAccessKey: "head:crown", "color:gold", "pet:kitten").
-- The server is the only writer (service role, through admin-checked routes): admin grants, earn grants, season grants,
-- and (later) purchases. Clients only READ their own rows. A client can never insert one.
-- Free / Pro / seasonal access is NOT stored here (computed from the access table + profiles.is_pro + the date); a saved
-- look is grandfathered by the saved avatar_config itself. An owned row makes a part saveable WITHOUT Pro.

create table if not exists public.owned_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  item_key        text not null check (item_key ~ '^[a-zA-Z]+:[a-z0-9-]+$'),
  source          text not null check (source in ('buy', 'earn', 'grant', 'season', 'restore')),
  -- who handed it out: the admin for source = 'grant' (null for earn / buy / season)
  granted_by      uuid references public.profiles(id) on delete set null,
  platform        text not null default 'server' check (platform in ('ios', 'android', 'web', 'server')),
  transaction_id  text unique,
  price_cents     integer check (price_cents is null or price_cents >= 0),
  currency        text,
  earn_reason     text,
  acquired_at     timestamptz not null default now(),
  -- a revoke / refund keeps the row for the audit trail; access ignores revoked rows
  revoked_at      timestamptz,
  unique (user_id, item_key)
);

create index if not exists owned_items_user_idx on public.owned_items (user_id) where revoked_at is null;

alter table public.owned_items enable row level security;

drop policy if exists "owned_items_select_own" on public.owned_items;
create policy "owned_items_select_own" on public.owned_items
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.owned_items from anon, authenticated;
grant select on public.owned_items to authenticated;

-- The owned keys the clients load: active rows only.
create or replace view public.my_owned_items with (security_invoker = true) as
  select item_key, source, acquired_at from public.owned_items where user_id = auth.uid() and revoked_at is null;
grant select on public.my_owned_items to authenticated;

-- Every grant / revoke is logged (who, what, to whom, when). Admin-only: no client policy, no grants.
create table if not exists public.owned_items_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_key   text not null,
  action     text not null check (action in ('grant', 'revoke')),
  source     text not null,
  actor      uuid references public.profiles(id) on delete set null,
  at         timestamptz not null default now()
);

create index if not exists owned_items_log_user_idx on public.owned_items_log (user_id, at desc);
alter table public.owned_items_log enable row level security;
revoke all on public.owned_items_log from anon, authenticated;
