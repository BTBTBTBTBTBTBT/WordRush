/*
  # Hints Tracking + "Pure" Achievement Plumbing

  Adds a `hints_used` column to `daily_results` and `matches` so the
  composite-score formula can apply a per-hint penalty and the
  achievement service can count hintless wins. Default 0 grandfathers
  every existing row as "hintless" — historical scores stay put (the
  penalty term is 0 for them), and old qualifying wins back-credit
  toward the new Pure achievements when the backfill endpoint runs.

  Only modes that expose hint buttons today (DUEL_6, DUEL_7,
  PROPERNOUNDLE) will ever write a non-zero value, but the column lives
  on every row regardless so the score formula and leaderboard queries
  can stay mode-agnostic.
*/

-- ============================================================
-- daily_results: per-day per-mode hints used
-- ============================================================
ALTER TABLE daily_results
  ADD COLUMN IF NOT EXISTS hints_used integer NOT NULL DEFAULT 0;

-- ============================================================
-- matches: per-game hints used (powers achievement queries that
-- need to count hintless wins across both daily and practice plays)
-- ============================================================
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS hints_used integer NOT NULL DEFAULT 0;

-- Index for "hintless wins per mode per user" — the shape every Pure
-- achievement check uses. Partial index keeps it small: only the
-- hints_used=0 wins are indexed (and only solo rows, since the three
-- modes the Pure ladder targets are solo-only).
CREATE INDEX IF NOT EXISTS idx_matches_hintless_wins
  ON matches (player1_id, game_mode)
  WHERE hints_used = 0 AND winner_id IS NOT NULL AND player2_id IS NULL;
