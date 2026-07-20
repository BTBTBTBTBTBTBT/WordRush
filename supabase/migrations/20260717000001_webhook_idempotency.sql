-- Idempotency ledger for store webhooks (App Store Server Notifications V2 and
-- Google Play RTDN). Each notification carries a unique id; recording it before
-- applying the entitlement change lets a replayed or duplicate delivery no-op
-- instead of re-granting shields or re-applying a stale state (audit #7).
--
-- Service-role only (the webhooks); no RLS grants to authenticated/anon.
create table if not exists public.store_webhook_events (
  event_id     text primary key,
  source       text not null,            -- 'appstore' | 'playstore'
  processed_at timestamptz not null default now()
);

alter table public.store_webhook_events enable row level security;
-- No policies → only the service role (which bypasses RLS) can read/write.
