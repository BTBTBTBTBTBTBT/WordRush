-- Mascot item gating: the server-side owned-items ledger (docs/cloud-prompts/11; docs/design/brand/avatar/UNLOCKS-AND-SHOP.md).
-- NOT APPLIED. Ships with the itemGating flag OFF; apply when the founder approves the access table
-- (docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.md) and the purchase flow is built.
--
-- One row = one player owns one mascot option, forever. item_key is the access-table key "<field>:<id>"
-- (packages/core/src/avatar-access.ts avatarAccessKey: "head:crown", "color:gold", "pet:kitten").
-- The server is the only writer (service role): purchases (Apple / Google IAP, Stripe on the web — stubbed today),
-- earn grants (core avatarEarnedKeys over the player's profile stats + achievements), and admin grants.
-- Clients only READ their own rows; a client can never insert one (no client-side unlock hacks).
-- A purchase on any platform shows up everywhere (one ledger).
--
-- Free / Pro / seasonal access is NOT stored here (it is computed from the table + profiles.is_pro + the date);
-- a saved look is grandfathered by the saved avatar_config itself, not by a row.

create table if not exists public.owned_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  item_key        text not null check (item_key ~ '^[a-zA-Z]+:[a-z0-9-]+$'),
  source          text not null check (source in ('buy', 'earn', 'grant', 'restore')),
  -- buy: the store the purchase came through; earn / grant: 'server'
  platform        text not null default 'server' check (platform in ('ios', 'android', 'web', 'server')),
  -- the store's transaction id (Apple originalTransactionId / Google purchaseToken / Stripe payment_intent); unique so a
  -- receipt can't be replayed onto two accounts
  transaction_id  text unique,
  price_cents     integer check (price_cents is null or price_cents >= 0),
  currency        text,
  -- earn: the condition that granted it (achievement key or "stat:bestStreak>=30"), for support / audit
  earn_reason     text,
  acquired_at     timestamptz not null default now(),
  -- a refund / chargeback revokes (the row stays for the audit trail; access ignores revoked rows)
  revoked_at      timestamptz,
  unique (user_id, item_key)
);

create index if not exists owned_items_user_idx on public.owned_items (user_id) where revoked_at is null;

alter table public.owned_items enable row level security;

-- Players read their own ledger. No insert / update / delete policies: only the service role writes.
drop policy if exists "owned_items_select_own" on public.owned_items;
create policy "owned_items_select_own" on public.owned_items
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.owned_items from anon, authenticated;
grant select on public.owned_items to authenticated;

-- The owned keys the clients load (the access context's `owned`): active rows only.
create or replace view public.my_owned_items with (security_invoker = true) as
  select item_key, source, acquired_at from public.owned_items where user_id = auth.uid() and revoked_at is null;
grant select on public.my_owned_items to authenticated;

-- Earn grants are idempotent: the server upserts (user_id, item_key) with on conflict do nothing, so re-running
-- avatarEarnedKeys after every recorded game never duplicates a row and never overwrites a purchase.
