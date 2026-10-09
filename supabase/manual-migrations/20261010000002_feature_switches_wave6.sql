-- 2.8 wave 6 off-switches (FAIL-OPEN, same resolver as 20261009000001): podium mini Stage card, podium confetti burst,
-- cast cheer on Sweep/Flawless, Flawless seal count. Idempotent (never overwrites a row the founder already changed).
insert into public.app_flags (key, enabled, audience, note) values
  ('podium_stage_card', true, 'all', '2.8 off-switch: tap a podium mascot opens its mini Stage card (off = opens the profile)'),
  ('podium_burst', true, 'all', '2.8 off-switch: the winner''s confetti burst when a podium opens'),
  ('cast_cheer', true, 'all', '2.8 off-switch: the whole cast hops when your mascot celebrates a Sweep / Flawless'),
  ('flawless_seal', true, 'all', '2.8 off-switch: the gold seal with your Flawless run count on the Flawless popup')
on conflict (key) do nothing;
