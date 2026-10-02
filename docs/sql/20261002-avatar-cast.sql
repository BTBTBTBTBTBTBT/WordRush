-- ⚠️ MANUAL MIGRATION — apply by hand AFTER a backup (scripts/db-backup.sh),
-- same pattern as supabase/manual-migrations/*. Idempotent — safe to re-run.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f docs/sql/20261002-avatar-cast.sql
--   or paste into the Supabase dashboard SQL editor.
--
-- Pick-a-character avatars (FINISH_SPEC AH) + the build-your-own-mascot
-- config (FINISH_SPEC AN), founder 2026-10-02.
--
-- 1. profiles.avatar_cast_id — the cast hero the player wears as their avatar
--    (w o1 r d o2 c i o3 u s, the WORDOCIOUS cast ids in apps/web/lib/mascots.ts
--    and the BOT_CAST castId in packages/core/src/bot-cast.ts). NULL = the
--    player's photo, or their initials / emoji letter tile when there is no
--    photo (today's behavior).
-- 2. profiles.avatar_frame — the level-tier frame ring the player chose
--    (bronze/silver/gold/platinum/diamond, core levelTier). NULL = automatic:
--    the frame of the player's current tier. Clients clamp a stored frame to
--    the tiers the level has unlocked, so a stale/forged higher frame never
--    shows; the CHECK only guards the vocabulary.
--
-- WRITE PATH (no extra grant / policy needed — verified 2026-10-02)
--   * RLS: the existing "Users can update own profile" policy (auth.uid() = id)
--     covers own-row updates of any column, exactly like bio / accent_color /
--     is_private (20260806000001_profile_privacy.sql).
--   * protect_pro_columns_trg (20260723000001_medals_lockdown.sql) only pins
--     is_admin / is_banned / medal counters / is_pro / pro_expires_at; the new
--     columns pass through. guard_profile_content_trg only screens username/bio;
--     enforce_username_policy_trg fires on `update of username` only.
--   * No column-level GRANT/REVOKE exists on public.profiles (grep of
--     supabase/: none), so the table-level UPDATE privilege Supabase gives
--     `authenticated` already includes newly added columns.
--   * SELECT on profiles is `using (true)` for authenticated, so other players'
--     clients can read the choice (it is public cosmetics, like avatar_url).
--
-- CLIENTS SHIP BEFORE THIS IS APPLIED: web reads the columns only from
-- select('*') rows (missing = null) and an update that names them falls back
-- on PGRST204 / 42703 (saves the rest, keeps the choice locally, retries).

alter table public.profiles
  add column if not exists avatar_cast_id text null,
  add column if not exists avatar_frame text null,
  -- FINISH_SPEC AN3: the build-your-own-mascot config,
  -- {v:1, body, color, pattern, patternColor, eyes, nose, mouth, head, face, neck, frame}
  -- (packages/core/src/avatar-config.ts validateAvatar; unknown ids fall back
  -- to defaults client-side, so no CHECK beyond "is an object"). NULL = the
  -- deterministic default mascot (core defaultAvatar) unless the player has a photo.
  add column if not exists avatar_config jsonb null;

alter table public.profiles drop constraint if exists profiles_avatar_config_check;
alter table public.profiles
  add constraint profiles_avatar_config_check
  check (avatar_config is null or (jsonb_typeof(avatar_config) = 'object' and pg_column_size(avatar_config) < 2048));

alter table public.profiles drop constraint if exists profiles_avatar_cast_id_check;
alter table public.profiles
  add constraint profiles_avatar_cast_id_check
  check (avatar_cast_id is null
         or avatar_cast_id in ('w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'));

alter table public.profiles drop constraint if exists profiles_avatar_frame_check;
alter table public.profiles
  add constraint profiles_avatar_frame_check
  check (avatar_frame is null
         or avatar_frame in ('none', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'pro'));

-- PostgREST caches the schema: make the new columns visible to the API now
-- (otherwise writes keep failing with PGRST204 until the next reload).
notify pgrst, 'reload schema';

-- Verification:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('avatar_cast_id', 'avatar_frame', 'avatar_config');
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profiles'::regclass
--     and conname in ('profiles_avatar_cast_id_check', 'profiles_avatar_frame_check');
