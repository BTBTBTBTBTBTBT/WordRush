-- ⚠️ PROPOSED MANUAL MIGRATION: NOT APPLIED. OPTIONAL. Apply by hand AFTER a
-- backup (scripts/db-backup.sh). Idempotent: safe to re-run.
--
-- The admin Achievements page (/admin/achievements, api/admin/achievements)
-- counts unlocks per achievement with one head query per key (~110 keys, all
-- time + last 7 days). achievements is indexed by user_id (idx_achievements_user)
-- and the (user_id, achievement_key) unique key, neither of which serves a
-- filter on achievement_key alone, so each count is a sequential scan. That is
-- fine at today's size; this index keeps the page fast as the table grows.
-- Nothing depends on it: the page works the same without it.

create index if not exists idx_achievements_key_unlocked
  on public.achievements (achievement_key, unlocked_at);

-- Read back:
--   select indexname from pg_indexes
--   where schemaname = 'public' and tablename = 'achievements';
