-- MORE GAMES PODIUM BACKFILL (Stats + Friends redesign D4, founder: "All games
-- should have medals", 2026-09-26). The daily-medals cron iterated a hand-typed
-- nine-mode list until §287, so the ten More Games titles had no podium on the
-- public days before the fix: launch day 2026-09-24 and 2026-09-25 (2026-09-26 is
-- awarded by the cron's own next run). ProperNoundle was already in the old list.
--
-- Mirrors apps/web/app/api/cron/daily-medals/route.ts exactly: per (day, mode,
-- play_type) take the top six by composite_score desc, time_seconds asc,
-- created_at asc; competition ranking over (score, time) so exact ties share a
-- medal; ranks 1–3 → gold/silver/bronze; INSERT guarded by the
-- (user_id, day, game_mode, play_type, medal_type) unique key so a re-run
-- awards nothing twice; each new medal bumps the profile counter and grants
-- 100/50/25 XP with level = floor(xp/1000)+1. Hand-applied via scripts/db-apply.sh
-- after scripts/db-backup.sh (backup 20260926T233709Z).
do $$
declare
  d date;
  m text;
  pt text;
  r record;
  medal text;
  xp_bonus int;
  inserted int := 0;
  skipped int := 0;
begin
  foreach d in array array['2026-09-24','2026-09-25']::date[] loop
    foreach m in array array['SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS'] loop
      foreach pt in array array['solo','vs'] loop
        for r in
          select t.user_id, t.composite_score,
                 rank() over (order by t.composite_score desc, t.time_seconds asc) as rk
          from (
            select user_id, composite_score, time_seconds, created_at
            from public.daily_results
            where day = d and game_mode = m and play_type = pt and composite_score > 0
            order by composite_score desc, time_seconds asc, created_at asc
            limit 6
          ) t
        loop
          if r.rk > 3 then continue; end if;
          medal := case r.rk when 1 then 'gold' when 2 then 'silver' else 'bronze' end;
          xp_bonus := case medal when 'gold' then 100 when 'silver' then 50 else 25 end;
          begin
            insert into public.medals (user_id, day, game_mode, play_type, medal_type, composite_score)
            values (r.user_id, d, m, pt, medal, r.composite_score);
          exception when unique_violation then
            skipped := skipped + 1;
            continue;
          end;
          execute format(
            'update public.profiles set %I = coalesce(%I, 0) + 1, xp = coalesce(xp, 0) + $1, level = floor((coalesce(xp, 0) + $1) / 1000.0) + 1 where id = $2',
            medal || '_medals', medal || '_medals'
          ) using xp_bonus, r.user_id;
          inserted := inserted + 1;
        end loop;
      end loop;
    end loop;
  end loop;
  raise notice 'more-games medal backfill: inserted %, already present %', inserted, skipped;
end $$;

-- Read-back:
--   select day, game_mode, medal_type, count(*) from medals
--     where game_mode in ('SUDOKU','SCRAMBLE','HUB','CROSSWORD','GROUPS','LADDER','CRYPTOGRAM','WORDSEARCH','REGIONS')
--     group by 1,2,3 order by 1,2,3;
