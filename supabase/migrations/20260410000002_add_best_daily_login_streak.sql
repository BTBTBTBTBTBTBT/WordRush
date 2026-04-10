-- Add best_daily_login_streak to track the highest daily login streak achieved.
-- This is separate from best_streak which tracks consecutive game wins.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS best_daily_login_streak integer DEFAULT 0 NOT NULL;

-- Backfill: set best_daily_login_streak to at least current daily_login_streak
UPDATE profiles
  SET best_daily_login_streak = daily_login_streak
  WHERE daily_login_streak > best_daily_login_streak;
