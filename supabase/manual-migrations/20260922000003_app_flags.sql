-- ⚠️ MANUAL MIGRATION — More Games Stage 7 (kill switch). NOT YET APPLIED.
-- Apply by hand in the dashboard SQL editor at Stage 8, AFTER `bash
-- scripts/db-backup.sh`. Idempotent: safe to re-run.
--
-- app_flags is the remote gate for every More Games title and the More Games
-- tile itself (plan §7 + §10). A mode is visible on a device when its catalog
-- record is enabled AND its flag row says so for THIS viewer:
--
--   enabled = false            → hidden for everyone (the kill switch)
--   enabled, audience 'testers' → visible to profiles.is_admin or role in
--                                 ('admin','tester') only — the TestFlight /
--                                 Play-internal test gate
--   enabled, audience 'all'     → visible to everyone — the public launch
--   no row                      → the catalog's `enabled` alone decides
--
-- Clients read the table directly (anon + authenticated, RLS read-only) and
-- resolve the audience against their own profile; only the service role
-- writes (admin > Ops > Feature flags, /api/admin/flags). Flipping audience
-- to 'all' is the public launch and needs no rebuild.

create table if not exists public.app_flags (
  key         text primary key,
  enabled     boolean not null default false,
  audience    text not null default 'testers'
              constraint app_flags_valid_audience check (audience in ('all', 'testers')),
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.app_flags enable row level security;

drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags
  for select to anon, authenticated using (true);
-- No insert/update/delete policies: writes are service-role only.

grant select on public.app_flags to anon, authenticated;

-- Seeds: every gate starts ENABLED FOR TESTERS, so a game becomes testable on
-- TestFlight the moment its catalog record flips to enabled, and invisible to
-- players until `audience` is set to 'all' on the founder's word.
insert into public.app_flags (key, enabled, audience, note) values
  ('menu.more',        true, 'testers', 'The More Games tile + sheet'),
  ('mode.sudoku',      true, 'testers', 'Sudoku'),
  ('mode.scramble',    true, 'testers', 'Muddle'),
  ('mode.hub',         true, 'testers', 'Hubbub'),
  ('mode.crossword',   true, 'testers', 'Crosswordocious'),
  ('mode.groups',      true, 'testers', 'Kindred'),
  ('mode.ladder',      true, 'testers', 'Letter Ladder'),
  ('mode.cryptogram',  true, 'testers', 'Codebreaker'),
  ('mode.wordsearch',  true, 'testers', 'Spyglass'),
  ('mode.regions',     true, 'testers', 'Starsweep')
on conflict (key) do nothing;

-- Read-back:
--   select key, enabled, audience from public.app_flags order by key;   -- 10 rows, all testers
--   select polname, polcmd from pg_policy where polrelid = 'public.app_flags'::regclass;  -- app_flags_read / r
