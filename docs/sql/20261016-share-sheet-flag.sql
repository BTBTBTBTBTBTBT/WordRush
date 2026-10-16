-- Custom share sheet (direction A): the web gate. NOT RUN. Testers/admins only until the founder approves,
-- then `update public.app_flags set audience = 'all' where key = 'share_sheet_v2';`.
-- The web needs this row to exist (a missing row keeps the old chooser); enabled = false is the off-switch.
insert into public.app_flags (key, enabled, audience, note) values
  ('share_sheet_v2', true, 'testers', 'Custom share sheet (carousel of cards, No spoilers toggle, look swatches, channels). Testers first.')
on conflict (key) do nothing;
