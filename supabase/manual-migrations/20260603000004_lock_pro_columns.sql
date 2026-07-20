-- ⚠️ MANUAL MIGRATION — moved OUT of supabase/migrations/ on purpose (2026-07-17).
-- A routine `supabase db push` applies every file in supabase/migrations/;
-- applying THIS before the webhooks are the source of truth would stop real
-- purchases from granting Pro (clients can no longer write is_pro /
-- pro_expires_at / streak_shields). Apply BY HAND, only after the go-live
-- checklist in PAYMENTS_RUNBOOK.md verifies a webhook in Sandbox.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260603000004_lock_pro_columns.sql
-- Idempotent (create or replace + drop trigger if exists) — safe to re-run.
--
-- Purpose: close the entitlement hole where any authenticated client can set
-- its own profiles.is_pro = true (and mint streak_shields) via the REST API.
-- After this runs, only the service-role (the verified webhooks) can change
-- those columns; client writes to them are silently reverted.
--
-- Note: this also disables the dev "Simulate Pro" toggle and client-side shield
-- mutations; use SQL / an admin RPC when testing after this is applied.

create or replace function public.protect_pro_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The webhook uses the service-role key → allow it through.
  if auth.role() = 'service_role' then
    return new;
  end if;
  -- Everyone else cannot change entitlement columns — revert to old values.
  new.is_pro := old.is_pro;
  new.pro_expires_at := old.pro_expires_at;
  -- Streak shields have real value (streak protection) and were client-writable
  -- even under the original trigger — lock them too (audit F8).
  new.streak_shields := old.streak_shields;
  return new;
end;
$$;

drop trigger if exists protect_pro_columns_trg on public.profiles;
create trigger protect_pro_columns_trg
  before update on public.profiles
  for each row execute function public.protect_pro_columns();
