-- ⚠️ MANUAL MIGRATION — apply by hand (dashboard SQL editor or psql).
-- Idempotent — safe to re-run: it recomputes both flags from ground truth, so
-- a second run finds nothing left to change (updated-row count = 0) and the
-- before/after verification counts come out equal.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/manual-migrations/20260804000002_repair_daily_bonuses.sql
--   or paste into the Supabase dashboard SQL editor (single transaction).
--
-- Purpose (2026-08-04): DATA REPAIR for daily_bonuses poisoned by the adaptive
-- award bug. /api/daily/award-bonuses used to infer the required mode count
-- from "what modes did ANYONE record that local day", so the first player of a
-- day could "sweep" (and even go "flawless") after ONE game (1 >= 1). Those
-- fake sweep_awarded / flawless_awarded rows inflate sweep counts, streaks,
-- and (until the 20260804000001 guard) "best sweep time". The backfill route
-- (/api/admin/backfill-daily-bonuses) only UPSERTS true — it can add missing
-- sweeps but can never clear a poisoned flag. This migration RECOMPUTES both
-- flags for EVERY existing daily_bonuses row from daily_results ground truth:
--
--   sweep_awarded    = distinct daily-mode rows for (user, local day) >= era count
--   flawless_awarded = distinct daily-mode rows WON (completed = true) >= era count
--   era count        = 7 for days before '2026-05-21', 9 on/after
--                      (DUEL_6/DUEL_7 dailies shipped 2026-05-21 — keep in sync
--                      with apps/web/lib/daily-modes.ts requiredDailyModeCount)
--
-- Predicates mirror the award + backfill routes exactly: play_type = 'solo',
-- game_mode in the 9 canonical daily modes (DUEL, QUORDLE, OCTORDLE, SEQUENCE,
-- RESCUE, GAUNTLET, PROPERNOUNDLE, DUEL_6, DUEL_7), won = completed.
-- daily_results.day is `date`; daily_bonuses.day is text local YYYY-MM-DD
-- (cast for the join; text comparison vs '2026-05-21' is safe for ISO dates).
--
-- Rows are NEVER deleted (the XP already granted is waived; the flags just
-- tell the truth from now on), and only rows whose flags actually change are
-- touched (IS DISTINCT FROM guard), so updated_at is preserved elsewhere.
-- Ends with verification SELECTs (before/after totals + the founder-relevant
-- last-10-days sweep picture for the 3 most-affected users, user_id prefix
-- only). Everything runs in one transaction; temp tables drop on commit.

begin;

-- ── Snapshot the current flags (drives before/after + most-affected checks) ──
create temp table _bonus_rows_before on commit drop as
  select user_id, day, sweep_awarded, flawless_awarded
  from daily_bonuses;

-- ── Recompute both flags for every row from daily_results ground truth ───────
with truth as (
  select db.user_id,
         db.day,
         coalesce(t.modes, 0)     as modes,
         coalesce(t.won_modes, 0) as won_modes,
         (case when db.day < '2026-05-21' then 7 else 9 end) as required
  from daily_bonuses db
  left join lateral (
    select count(distinct dr.game_mode)                                as modes,
           count(distinct dr.game_mode) filter (where dr.completed)    as won_modes
    from daily_results dr
    where dr.user_id = db.user_id
      and dr.day = db.day::date
      and dr.play_type = 'solo'
      and dr.game_mode in ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE',
                           'GAUNTLET','PROPERNOUNDLE','DUEL_6','DUEL_7')
  ) t on true
)
update daily_bonuses db
set sweep_awarded    = (tr.modes >= tr.required),
    flawless_awarded = (tr.won_modes >= tr.required),
    updated_at       = now()
from truth tr
where tr.user_id = db.user_id
  and tr.day = db.day
  and (db.sweep_awarded    is distinct from (tr.modes >= tr.required)
    or db.flawless_awarded is distinct from (tr.won_modes >= tr.required));

-- ── Verification 1: totals + sweeps/flawless before vs after ─────────────────
select 'totals' as check,
       (select count(*) from _bonus_rows_before)                                   as rows_before,
       (select count(*) from daily_bonuses)                                        as rows_after,
       (select count(*) filter (where sweep_awarded)    from _bonus_rows_before)   as sweeps_before,
       (select count(*) filter (where sweep_awarded)    from daily_bonuses)        as sweeps_after,
       (select count(*) filter (where flawless_awarded) from _bonus_rows_before)   as flawless_before,
       (select count(*) filter (where flawless_awarded) from daily_bonuses)        as flawless_after;

-- ── Verification 2: how many rows changed, per flag ──────────────────────────
select 'changed_rows' as check,
       count(*) filter (where b.sweep_awarded    is distinct from n.sweep_awarded)    as sweep_flag_changed,
       count(*) filter (where b.flawless_awarded is distinct from n.flawless_awarded) as flawless_flag_changed,
       count(*) filter (where b.sweep_awarded and not n.sweep_awarded)                as fake_sweeps_cleared,
       count(*) filter (where not b.sweep_awarded and n.sweep_awarded)                as real_sweeps_restored
from _bonus_rows_before b
join daily_bonuses n on n.user_id = b.user_id and n.day = b.day;

-- ── Verification 3: founder-relevant — last 10 sweep-flag days for the 3 most-
--    affected users (user_id prefix only; eyeball the current streak here) ────
with affected as (
  select b.user_id, count(*) as flags_changed
  from _bonus_rows_before b
  join daily_bonuses n on n.user_id = b.user_id and n.day = b.day
  where b.sweep_awarded    is distinct from n.sweep_awarded
     or b.flawless_awarded is distinct from n.flawless_awarded
  group by b.user_id
  order by flags_changed desc, b.user_id
  limit 3
)
select left(a.user_id::text, 8) as user_prefix,
       a.flags_changed,
       r.day,
       r.sweep_awarded,
       r.flawless_awarded
from affected a
join lateral (
  select db.day, db.sweep_awarded, db.flawless_awarded
  from daily_bonuses db
  where db.user_id = a.user_id
  order by db.day desc
  limit 10
) r on true
order by a.flags_changed desc, user_prefix, r.day desc;

commit;
