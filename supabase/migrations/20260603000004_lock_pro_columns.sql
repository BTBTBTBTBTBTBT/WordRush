-- ⚠️ DEFERRED MIGRATION — DO NOT RUN until the App Store Server Notifications
-- webhook (apps/web/app/api/appstore/notifications) has been verified in
-- SANDBOX. Running this BEFORE the webhook works will stop real purchases from
-- granting Pro (clients can no longer write is_pro / pro_expires_at), so the
-- server path must be the source of truth first.
--
-- Purpose: close the entitlement hole where any authenticated client can set
-- its own profiles.is_pro = true via the REST API. After this runs, only the
-- service-role (the verified webhook) can change is_pro / pro_expires_at; client
-- writes to those columns are silently reverted.
--
-- Note: this also disables the dev "Simulate Pro" toggle (it writes is_pro from
-- an authenticated client); flip is_pro via SQL instead when testing.

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
  return new;
end;
$$;

drop trigger if exists protect_pro_columns_trg on public.profiles;
create trigger protect_pro_columns_trg
  before update on public.profiles
  for each row execute function public.protect_pro_columns();
