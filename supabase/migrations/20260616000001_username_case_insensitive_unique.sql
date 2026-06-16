-- Case-insensitive username uniqueness.
--
-- profiles.username already has an exact-case UNIQUE constraint, so "BMT" and
-- "bmt" were considered distinct and could both be registered. We don't want
-- multiple usernames that differ only by case. This adds a UNIQUE index on
-- lower(username), so any case-variant of an existing name is rejected.
--
-- A violation raises SQLSTATE 23505 (unique_violation), which:
--   • the clients already map to "Username already taken" (web/iOS/Android
--     edit handlers detect 23505 / "duplicate"), and
--   • the handle_new_user() signup trigger already catches (its
--     `exception when unique_violation` branch appends a unique suffix),
-- so no application code needs to change.
--
-- NOTE: if the table already contains case-variant duplicates (e.g. both "BMT"
-- and "bmt"), this index creation will fail. Detect them first with:
--   select lower(username), count(*) from public.profiles
--   group by lower(username) having count(*) > 1;
-- and resolve (rename one) before applying.

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (lower(username));
