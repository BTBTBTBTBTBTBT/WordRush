-- 2.8 wave 1 off-switches (FAIL-OPEN, same resolver as 20261009000001): header condense + bubble atlas.
-- Idempotent (never overwrites a row the founder already changed).
insert into public.app_flags (key, enabled, audience, note) values
  ('header_condense', true, 'all', '2.8 off-switch: cast header slims on scroll (the soft fade stays)'),
  ('bubble_atlas', true, 'all', '2.8 off-switch: bubble-letter atlas for changing headlines (off = live headline font)')
on conflict (key) do nothing;
