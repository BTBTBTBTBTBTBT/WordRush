-- Share sheet tracked links (docs/review/share-sheet-plan.md §2, packages/core/src/share-sheet.ts SHARE_CHANNEL_SLUGS).
-- The in-app share sheet sends wordocious.com/go/<slug> on the channels that carry a link (Copy link, Messages and
-- WhatsApp on the web, X, Facebook sharer, Snapchat web). Existing slugs x / instagram / facebook / tiktok are reused;
-- these four are new so profiles.signup_source can tell share-driven signups from bio links.
-- NOT RUN YET: apply via db-backup.sh -> psql (sql-driving-authorized), then read back.

insert into public.marketing_links (slug, target, channel) values
  ('copy',     'https://wordocious.com/', 'share'),
  ('msg',      'https://wordocious.com/', 'share'),
  ('wa',       'https://wordocious.com/', 'share'),
  ('snapchat', 'https://wordocious.com/', 'snapchat')
on conflict (slug) do nothing;

-- Verification
select slug, channel, clicks from public.marketing_links where slug in ('copy', 'msg', 'wa', 'snapchat', 'x', 'instagram', 'facebook', 'tiktok') order by slug;
