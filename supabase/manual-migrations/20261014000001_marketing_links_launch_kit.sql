-- Launch-kit tracked links (applied by hand 2026-10-14 after scripts/db-backup.sh).
-- Bios and posts for the JP launch kit use /go/<slug>; these three had no row yet.
insert into public.marketing_links (slug, target, channel) values
  ('linkedin',    'https://wordocious.com/', 'linkedin'),
  ('producthunt', 'https://wordocious.com/', 'producthunt'),
  ('press',       'https://wordocious.com/', 'press')
on conflict (slug) do nothing;

select slug, channel from public.marketing_links where slug !~ '^p-' order by slug;
