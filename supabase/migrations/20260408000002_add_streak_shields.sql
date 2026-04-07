-- Streak shields: protect daily login streaks from being reset
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_shields integer DEFAULT 0 NOT NULL;
