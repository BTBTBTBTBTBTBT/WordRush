-- 2.8 item 24: "Seasonal" theme opt-out, synced to the account. A player who picks another theme inside a season
-- window opts out of the seasonal look for THAT season + year ("halloween:2026"); the row in Settings > Theme and
-- every season resolver (web activeSeason, iOS CastSkin, Android SeasonSkins) read it. The column is user-writable
-- (it is a preference, like notification_prefs); a missing column is ignored by the clients until this is applied.
--
-- Apply: scripts/db-backup.sh, then psql from ~/.wordocious-db-url, read back.
alter table public.profiles
  add column if not exists season_opt_out text;

-- Read back:
--   select season_opt_out, count(*) from public.profiles group by 1;
