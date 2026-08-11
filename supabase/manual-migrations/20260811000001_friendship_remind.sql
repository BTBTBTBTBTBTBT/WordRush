-- FRIENDS (§212, Aug 11): "Remind" on sent-pending invites. One column, no
-- policy changes — friendships stays service-role-write-only, and the remind
-- route enforces the 24h rate limit against this timestamp.
alter table public.friendships add column if not exists reminded_at timestamptz;
