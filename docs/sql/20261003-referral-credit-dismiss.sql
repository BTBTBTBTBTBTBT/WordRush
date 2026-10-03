-- FINISH_SPEC (founder 10-03): "my page is still showing 'Lord Matthew joined +3 days' under the gift a
-- week of Pro. I need to be able to X that so it goes away."
--
-- The server-side "dismissed" flag for a referral CREDIT notice (the inviter's settled rows on the
-- "Gift a week of Pro" card: "<name> joined! +3 days", "<name> subscribed! +1 free month"), so a
-- dismissal sticks across relaunches AND devices. Written only by the web API
-- (POST /api/referrals/dismiss, service role, scoped to the caller's own rows as inviter); read via
-- GET /api/referrals/dismiss. No RLS change: clients never select or write this column directly.
--
-- NOT APPLIED. Apply after a backup (scripts/db-backup.sh), then read back:
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'referrals' and column_name = 'inviter_dismissed_at';
-- Until it is applied, the apps keep working: every platform also keeps a per-user local dismissed
-- list keyed by the referral id, and the API answers [] / ok:false gracefully.
-- Idempotent.

alter table public.referrals
  add column if not exists inviter_dismissed_at timestamptz;

comment on column public.referrals.inviter_dismissed_at is
  'When the inviter dismissed this credit notice on the Gift a week of Pro card (null = still shown).';
