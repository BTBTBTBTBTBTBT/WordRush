-- Profile personalization: lets players express themselves on their profile.
-- Authored 2026-06-26 — APPLY MANUALLY in the Supabase SQL editor.
-- All additive + nullable, so existing rows and inserts that omit them are
-- unaffected. The existing "update own profile" RLS policy already covers these
-- new columns (no policy change needed).
--   bio                  — short tagline shown under the username (<= 80 chars)
--   featured_achievement — an achievement key the player has unlocked, worn as a title
--   accent_color         — hex from a fixed preset palette; tints username + tier
--                          badge + avatar fallback. NULL = default brand styling.
--   favorite_mode        — a mode dbKey (DUEL/QUORDLE/…) shown as a chip
--   avatar_emoji         — optional emoji shown in the avatar circle when no photo

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio                  text,
  ADD COLUMN IF NOT EXISTS featured_achievement text,
  ADD COLUMN IF NOT EXISTS accent_color         text,
  ADD COLUMN IF NOT EXISTS favorite_mode        text,
  ADD COLUMN IF NOT EXISTS avatar_emoji         text;

-- Keep bios short (client also enforces). Guard against re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_len'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_bio_len CHECK (char_length(bio) <= 80);
  END IF;
END $$;

-- Refresh the PostgREST schema cache so the new columns are queryable immediately.
NOTIFY pgrst, 'reload schema';
