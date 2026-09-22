# More Games Stage 0 — BEFORE snapshot (taken 2026-09-22, SQL editor, read-only)

Founder-authorised run of `20260922000000_more_games_stage0_snapshot.sql`. Every later DB step
(era functions, RPC re-creation, CHECK additions, the Stage 9 era switch) is diffed against this.

## 1. Totals (daily_bonuses)
sweeps_awarded **146** · flawless_awarded **44** · bonus_rows 158 · first_day 2026-04-21 · last_day 2026-09-22

## 2. Last 15 days (day: sweeps/flawless)
2026-09-08 1/0 · 09-09 2/0 · 09-10 1/0 · 09-11 2/0 · 09-12 2/0 · 09-13 1/1 · 09-14 1/1 · 09-15 2/1 · 09-16 1/0 · 09-17 2/1 · 09-18 1/0 · 09-19 1/1 · 09-20 1/1 · 09-21 2/1 · 09-22 1/1

## 3. daily_sweep_leaderboard, three known days (rank.user score time modes_won [F=flawless])
- 2026-09-14: 1.BMT 14930.23 pts 1661 s 9w F
- 2026-09-18: 1.BMT 15638.39 pts 1133 s 8w
- 2026-09-21: 1.BMT 16050.11 pts 1387 s 9w F | 2.Oliver 11738.51 pts 3750 s 7w

## 4. alltime_sweep_leaderboard (top 20 → 6 rows exist)
1.BMT 46 sweeps / 17 flawless, best 750 s · 2.Nichael 27/9, 1071 s · 3.BeanAndBuckwheat 14/3, 832 s · 4.Oliver 3/0, 3750 s · 5.Sydney McClure 1/0, 3521 s · 6.Michael 1/0, 3823 s

## 5. game_mode values in play
- daily_results: DUEL 596 · DUEL_6 250 · DUEL_7 223 · GAUNTLET 271 · OCTORDLE 302 · PROPERNOUNDLE 230 · QUORDLE 365 · RESCUE 244 · SEQUENCE 296
- matches: DUEL 621 · DUEL_6 315 · DUEL_7 235 · GAUNTLET 290 · OCTORDLE 301 · PROPERNOUNDLE 205 · QUORDLE 367 · RESCUE 243 · SEQUENCE 293
- user_stats: DUEL 32 · DUEL_6 16 · DUEL_7 14 · GAUNTLET 14 · OCTORDLE 15 · PROPERNOUNDLE 18 · QUORDLE 20 · RESCUE 16 · SEQUENCE 20

## 6. CHECK constraints today (the Stage 8 migration appends the 9 new keys to each game_mode list)
- daily_results.dr_valid_game_mode: DUEL, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, GAUNTLET, PROPERNOUNDLE, DUEL_6, DUEL_7
- daily_results.dr_valid_play_type: solo, vs
- daily_seeds.ds_valid_game_mode: same 9 as above
- matches.valid_game_mode: DUEL, MULTI_DUEL, GAUNTLET, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, TOURNAMENT, PROPERNOUNDLE, DUEL_6, DUEL_7
- matches.valid_scores / valid_times: non-negative
- user_stats.valid_game_mode: same 11 as matches
- user_stats.valid_play_type: solo, vs, vs_cpu
- user_stats.valid_stats: non-negative

## 7. Sweep RPCs present (era functions NOT yet present, as expected)
- alltime_sweep_leaderboard(p_limit int, p_offset int) — security definer
- alltime_sweep_rank(p_user uuid) — security definer
- daily_sweep_leaderboard(p_day text, p_limit int, p_offset int) — security invoker
- daily_sweep_rank(p_day text, p_user uuid) — security invoker
- sweep_modes_for_day / sweep_required_count: absent (generated, applied at Stage 8)

## 8. PITR
Not checked in this run (dashboard setting, not SQL). Confirm before Stage 8.
