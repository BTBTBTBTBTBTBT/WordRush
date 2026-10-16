-- Home headline pool (docs/review/home-headlines/PROPOSAL.md): the gate. NOT RUN. Testers/admins only until the
-- founder approves, then `update public.app_flags set audience = 'all' where key = 'home_headlines_v2';`.
-- Every platform needs this row to exist (a missing row keeps today's bannerHeadline line); enabled = false is the off-switch.
insert into public.app_flags (key, enabled, audience, note) values
  ('home_headlines_v2', true, 'testers', 'Home headline pool (time of day, season packs, holidays, last/next game, Double Flawless). Testers first.')
on conflict (key) do nothing;
