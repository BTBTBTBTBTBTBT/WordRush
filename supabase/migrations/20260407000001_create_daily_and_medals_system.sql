/*
  # Daily Challenge, Medals, Records & Achievements System

  ## New Tables
  - daily_seeds: One seed per game mode per day for fair daily competition
  - daily_results: Player performance per day per mode (leaderboard data)
  - medals: Gold/Silver/Bronze earned from daily top-3 finishes
  - all_time_records: Notable record holders across all categories
  - achievements: One-time unlockable badges

  ## Profile Additions
  - gold_medals, silver_medals, bronze_medals counters
  - last_played_at, daily_login_streak for retention features
*/

-- ============================================================
-- daily_seeds: deterministic daily puzzle seeds
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  game_mode text NOT NULL,
  seed text NOT NULL,
  solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(day, game_mode),
  CONSTRAINT ds_valid_game_mode CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET'))
);

CREATE INDEX IF NOT EXISTS idx_daily_seeds_day ON daily_seeds(day DESC);

-- ============================================================
-- daily_results: per-player daily performance
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  game_mode text NOT NULL,
  play_type text NOT NULL DEFAULT 'solo',
  completed boolean NOT NULL DEFAULT false,
  guess_count integer NOT NULL DEFAULT 0,
  time_seconds integer NOT NULL DEFAULT 0,
  boards_solved integer NOT NULL DEFAULT 0,
  total_boards integer NOT NULL DEFAULT 1,
  composite_score numeric(10,2) NOT NULL DEFAULT 0,
  vs_wins integer NOT NULL DEFAULT 0,
  vs_losses integer NOT NULL DEFAULT 0,
  vs_games integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, day, game_mode, play_type),
  CONSTRAINT dr_valid_play_type CHECK (play_type IN ('solo', 'vs')),
  CONSTRAINT dr_valid_game_mode CHECK (game_mode IN ('DUEL','QUORDLE','OCTORDLE','SEQUENCE','RESCUE','GAUNTLET'))
);

CREATE INDEX IF NOT EXISTS idx_daily_results_leaderboard ON daily_results(day, game_mode, play_type, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_results_user ON daily_results(user_id, day DESC);

-- ============================================================
-- medals: permanent record of daily top-3 placements
-- ============================================================
CREATE TABLE IF NOT EXISTS medals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  game_mode text NOT NULL,
  play_type text NOT NULL DEFAULT 'solo',
  medal_type text NOT NULL,
  composite_score numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, day, game_mode, play_type),
  CONSTRAINT m_valid_medal CHECK (medal_type IN ('gold', 'silver', 'bronze')),
  CONSTRAINT m_valid_play_type CHECK (play_type IN ('solo', 'vs'))
);

CREATE INDEX IF NOT EXISTS idx_medals_user ON medals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medals_day ON medals(day DESC, game_mode, medal_type);

-- ============================================================
-- all_time_records: notable record holders
-- ============================================================
CREATE TABLE IF NOT EXISTS all_time_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  game_mode text,
  play_type text,
  holder_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  record_value numeric(12,2) NOT NULL,
  achieved_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(record_type, game_mode, play_type)
);

-- ============================================================
-- achievements: one-time unlockable badges
-- ============================================================
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  unlocked_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

-- ============================================================
-- Add medal counters + retention columns to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gold_medals integer DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS silver_medals integer DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bronze_medals integer DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_played_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_login_streak integer DEFAULT 0 NOT NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- daily_seeds: publicly readable by authenticated users
ALTER TABLE daily_seeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily seeds"
  ON daily_seeds FOR SELECT
  TO authenticated
  USING (true);

-- daily_results: publicly readable, only owner can write
ALTER TABLE daily_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily results"
  ON daily_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own daily results"
  ON daily_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own daily results"
  ON daily_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- medals: publicly readable
ALTER TABLE medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view medals"
  ON medals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own medals"
  ON medals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- all_time_records: publicly readable, owner can write
ALTER TABLE all_time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view records"
  ON all_time_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upsert records they hold"
  ON all_time_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = holder_id);

CREATE POLICY "Users can update records they hold"
  ON all_time_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = holder_id)
  WITH CHECK (auth.uid() = holder_id);

-- achievements: owner only
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anyone to view user_stats (needed for leaderboard/records pages)
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
CREATE POLICY "Anyone can view user stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (true);

-- Trigger for daily_results updated_at
CREATE TRIGGER update_daily_results_updated_at
  BEFORE UPDATE ON daily_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
