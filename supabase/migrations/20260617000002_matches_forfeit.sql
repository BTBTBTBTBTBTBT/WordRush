-- VS forfeit flag: true when a match ended because a player disconnected/abandoned
-- (the remaining player is credited a win). Powers the "FORFEIT" tag in Recent
-- Matches. Authored 2026-06-17 — APPLY MANUALLY in the Supabase SQL editor.
-- Additive + defaulted, so existing rows and inserts that omit it are unaffected.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS forfeit boolean NOT NULL DEFAULT false;
