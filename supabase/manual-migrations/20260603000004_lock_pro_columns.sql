-- ⚠️ MANUAL MIGRATION — moved OUT of supabase/migrations/ on purpose (2026-07-17).
-- A routine `supabase db push` applies every file in supabase/migrations/;
-- applying THIS before the webhooks are the source of truth would stop real
-- purchases from granting Pro. Apply BY HAND, only after the go-live checklist
-- in PAYMENTS_RUNBOOK.md verifies a webhook in Sandbox.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260603000004_lock_pro_columns.sql
--   or paste into the Supabase dashboard SQL editor (runs as a direct
--   connection, which this trigger treats as trusted — see the role check).
-- Idempotent (create or replace + drop trigger if exists) — safe to re-run.
--
-- Purpose: close the entitlement hole where any authenticated client can
-- `PATCH /rest/v1/profiles?id=eq.<self>` with {"is_pro":true} via the shipped
-- anon key and grant itself free Pro. Supabase RLS can restrict which ROWS a
-- user updates but not which COLUMNS, so a trigger is the fix.
--
-- WHO CAN STILL WRITE THE PROTECTED COLUMNS after this:
--   • service-role (verified webhooks / verify endpoint) — real purchases.
--   • direct DB connections (dashboard SQL editor, psql) — you, as operator.
--   • ADMIN accounts (profiles.is_admin = true) may write is_pro / pro_expires_at
--     from the client — this preserves the in-app "Simulate Pro" dev toggle
--     (ProfileTab gates the button on is_admin) for you and any tester you
--     promote. To grant/revoke the button + the Pro-write privilege for someone,
--     set their profiles.is_admin from the dashboard (below). Regular
--     ('authenticated'/'anon') clients have Pro writes reverted.
--
-- is_admin / is_banned are ALSO locked for clients — without that, a user could
-- forge is_admin = true through the same REST hole and then use the admin bypass
-- to grant Pro. Only a direct connection / service-role can change admin status,
-- which is exactly the "control who gets the button from the admin side" knob.
--
-- SCOPE — streak_shields is DELIBERATELY NOT locked: it is a game-mechanic
-- column the client legitimately mutates on every platform — spend a shield
-- (ShieldService, -1) and earn the 7-day-login-streak shield (GameResultsService,
-- +1). Locking it would silently break both (the value snaps back to old). A
-- forged shield only protects a user's own login streak (no revenue impact).

create or replace function public.protect_pro_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the two PostgREST client roles are restricted. 'service_role'
  -- (webhooks), direct DB connections (auth.role() is null — dashboard/psql),
  -- and any other role pass through untouched.
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'anon' then
    return new;
  end if;

  -- Client write. Never let a client change admin or ban status — this is what
  -- makes the admin bypass below safe (no self-promotion → no forged Pro).
  new.is_admin  := old.is_admin;
  new.is_banned := old.is_banned;

  -- Paid-access columns: an EXISTING admin keeps the in-app Simulate Pro toggle;
  -- every other client has these writes reverted (closes the free-Pro hole).
  if not coalesce(old.is_admin, false) then
    new.is_pro         := old.is_pro;
    new.pro_expires_at := old.pro_expires_at;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_pro_columns_trg on public.profiles;
create trigger protect_pro_columns_trg
  before update on public.profiles
  for each row execute function public.protect_pro_columns();

-- To promote a tester (gives them the Simulate Pro button + the Pro-write
-- privilege), run from the dashboard / psql:
--   update public.profiles set is_admin = true  where username = 'THEIR_NAME';
-- To revoke:
--   update public.profiles set is_admin = false where username = 'THEIR_NAME';
