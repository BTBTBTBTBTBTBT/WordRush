-- 2.8 item 12: first-play welcome tutorials, once per game per player, synced across devices.
--
-- Apply (Opus): scripts/db-backup.sh, then psql "$(cat ~/.wordocious-db-url)" -f this file, read back.
--
-- profiles gets tutorials_seen text[]: the tutorial keys the player has dismissed ("practice", "hub",
-- "pocket-rps", ...; packages/core/src/pocket-help.ts). Clients read it with the rest of the profile,
-- add a key when the card closes, and write the SORTED UNION back (mergeTutorialsSeen) so two devices
-- never lose each other's keys. The owner's normal update policy covers it; nothing here is sensitive.
-- Guests keep a local copy only (web localStorage 'wordocious-tutorials-seen', iOS/Android prefs).
-- Off-switch: app_flags 'first_play_tutorials' (20261009000001) already exists.

alter table public.profiles
  add column if not exists tutorials_seen text[] not null default '{}';

-- Read back:
--   select count(*) filter (where cardinality(tutorials_seen) > 0) as seen_any, count(*) from public.profiles;
