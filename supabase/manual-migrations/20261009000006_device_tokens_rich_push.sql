-- 2.8 item 34: rich push. Android builds that draw their own notification (MessagingStyle + sender Person +
-- BigPicture) mark their token row so the server sends them a data-only message; older builds keep the
-- system-drawn notification payload. iOS needs no flag (the Notification Service Extension rides the same alert).
--
-- Apply: scripts/db-backup.sh, then psql from ~/.wordocious-db-url, read back.
alter table public.device_tokens
  add column if not exists rich_push boolean not null default false;

-- Read back:
--   select platform, rich_push, count(*) from public.device_tokens group by 1, 2;
