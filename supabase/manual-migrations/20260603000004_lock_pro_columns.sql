-- ⚠️ MANUAL MIGRATION — moved OUT of supabase/migrations/ on purpose (2026-07-17).
-- A routine `supabase db push` applies every file in supabase/migrations/;
-- applying THIS before the webhooks are the source of truth would stop real
-- purchases from granting Pro (clients can no longer write is_pro /
-- pro_expires_at). Apply BY HAND, only after the go-live checklist in
-- PAYMENTS_RUNBOOK.md verifies a webhook in Sandbox.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260603000004_lock_pro_columns.sql
-- Idempotent (create or replace + drop trigger if exists) — safe to re-run.
--
-- Purpose: close the entitlement hole where any authenticated client can set
-- its own profiles.is_pro = true via the REST API. After this runs, only the
-- service-role (the verified webhooks / verify endpoint) can change the paid-
-- access columns; client writes to them are silently reverted.
--
-- SCOPE — only is_pro + pro_expires_at (paid access). streak_shields is
-- DELIBERATELY NOT locked: it is a game-mechanic column the client legitimately
-- mutates on every platform — spend a shield (ShieldService, -1) and earn the
-- 7-day-login-streak shield (GameResultsService, +1). Locking it would silently
-- break both (the value snaps back to old). A forged shield only protects a
-- user's own login streak (no revenue impact), so it isn't worth breaking the
-- feature or moving spend/earn to server RPCs. If shield-forgery ever needs
-- closing, move those two client writes server-side FIRST, then add the column
-- here. (An earlier draft of this migration locked streak_shields — that was a
-- bug: it would have frozen every player's shields at their current count.)
--
-- Note: this also disables any dev "Simulate Pro" toggle that writes is_pro from
-- the client; use SQL / an admin RPC when testing Pro after this is applied.

create or replace function public.protect_pro_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The webhook / verify endpoint uses the service-role key → allow it through.
  if auth.role() = 'service_role' then
    return new;
  end if;
  -- Everyone else cannot change paid-access columns — revert to old values.
  -- (streak_shields is intentionally NOT reverted — see SCOPE note above.)
  new.is_pro := old.is_pro;
  new.pro_expires_at := old.pro_expires_at;
  return new;
end;
$$;

drop trigger if exists protect_pro_columns_trg on public.profiles;
create trigger protect_pro_columns_trg
  before update on public.profiles
  for each row execute function public.protect_pro_columns();
