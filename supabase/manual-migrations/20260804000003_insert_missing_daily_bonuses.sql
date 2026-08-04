-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent — the NOT EXISTS guard means a second run inserts 0 rows.
--
-- Companion to 20260804000002_repair_daily_bonuses.sql. The repair recomputed
-- flags on EXISTING daily_bonuses rows; this closes the last gap: (user, day)
-- pairs whose daily_results show a full era sweep but that have NO bonus row
-- at all (the live award route never fired — pre-award-logic days, or clients
-- where it didn't run). Found by post-repair audit on 2026-08-04: exactly 3
-- rows, all BMT — 2026-04-15 (7/7 era-7), 2026-04-18 (7/7), 2026-07-23 (9/9,
-- flawless). Same predicates as the repair (play_type 'solo', 9 canonical
-- modes, era count 7 before '2026-05-21' else 9, won = completed). No XP is
-- granted (matches the backfill route's stance: flags only, never XP).
insert into daily_bonuses (user_id, day, sweep_awarded, flawless_awarded)
select f.user_id,
       f.day::text,
       true,
       f.won >= (case when f.day::text < '2026-05-21' then 7 else 9 end)
from (
  select dr.user_id, dr.day,
         count(distinct dr.game_mode) as m,
         count(distinct dr.game_mode) filter (where dr.completed) as won
  from daily_results dr
  where dr.play_type = 'solo'
    and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                         'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')
  group by 1, 2
) f
where f.m >= (case when f.day::text < '2026-05-21' then 7 else 9 end)
  and not exists (select 1 from daily_bonuses db
                   where db.user_id = f.user_id and db.day = f.day::text)
returning day, sweep_awarded, flawless_awarded;
