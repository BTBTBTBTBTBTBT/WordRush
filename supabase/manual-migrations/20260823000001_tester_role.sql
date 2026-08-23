-- ⚠️ MANUAL MIGRATION — applied 2026-08-23 via the dashboard SQL editor.
-- Idempotent.
--
-- §228 — THE ADSENSE DISABLEMENT (2026-08-22): Google disabled publisher
-- pub-3015627373086578 for "invalid traffic and/or policy violations". Two
-- causes, both ours: (1) every developer/beta-tester session since Jun 1 ran on
-- LIVE ad units (no test devices, no test unit IDs), and (2) a second AdSense
-- account (the LLC's) coexisted with the personal one for 26 days.
--
-- This adds the 'tester' role: accounts that must NEVER generate ad traffic.
-- All three clients treat admin|tester like Pro for ads (AdsConfig.active /
-- AdsManager.active / AdBanner) — belt-and-braces over Pro, which expires.
alter table public.profiles drop constraint if exists valid_role;
alter table public.profiles
  add constraint valid_role check (role = any (array['user'::text, 'admin'::text, 'tester'::text]));

-- Known developer / beta / store-review accounts. Family accounts hold Pro
-- today, but Pro is a gift that expires; the role does not.
update public.profiles set role = 'tester'
where role = 'user'
  and username in ('DevTester', 'androidtester', 'appletest1234',
                   'MichaelPoopyFace', 'Michael3', 'Michael', 'Oliver', 'Carlie');
