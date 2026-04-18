-- Free-form socials block on user profiles. JSONB so we can add platforms
-- without touching the schema later.
--
-- Shape convention: { "twitter": "handle", "instagram": "handle",
-- "tiktok": "handle", "threads": "handle", "discord": "handle",
-- "website": "https://example.com" }
--
-- Handles are stored without the leading @ (the UI strips it on save and
-- the renderer adds it back). Website is a URL validated client-side and
-- rendered with rel="noopener noreferrer nofollow".

alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;
