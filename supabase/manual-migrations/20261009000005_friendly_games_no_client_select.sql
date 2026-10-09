-- 2.8 (Opus, 10-09): close a cheating hole — players could SELECT friendly_games through PostgREST and read
-- `secret` (Pass the Puzzle answer) and the opponent's raw RPS pick. No client reads the table directly
-- (web reads/writes it only through service-role API routes; iOS/Android go through those routes), so revoke
-- direct table access for the client roles. The service role is unaffected. Live play's backup channel uses
-- friendly_game_pings (revision numbers only).
revoke select, insert, update, delete on public.friendly_games from anon, authenticated;
