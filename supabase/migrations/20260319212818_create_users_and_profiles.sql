/*
  # Create Users and Profiles System

  ## Overview
  Sets up the core user authentication and profile management system for Wordle Duel multiplayer game.

  ## 1. New Tables
  
  ### `profiles`
  - `id` (uuid, primary key) - Links to auth.users
  - `username` (text, unique) - Display name for the player
  - `avatar_url` (text, nullable) - Profile picture URL
  - `level` (integer) - Current player level (starts at 1)
  - `xp` (integer) - Total experience points earned
  - `total_wins` (integer) - Lifetime wins across all modes
  - `total_losses` (integer) - Lifetime losses across all modes
  - `current_streak` (integer) - Current winning streak
  - `best_streak` (integer) - Highest winning streak achieved
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update timestamp

  ### `user_stats`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key) - References profiles
  - `game_mode` (text) - DUEL, MULTI_DUEL, GAUNTLET, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, TOURNAMENT
  - `wins` (integer) - Wins in this mode
  - `losses` (integer) - Losses in this mode
  - `total_games` (integer) - Total games played in this mode
  - `best_score` (integer) - Best score achieved
  - `average_time` (integer) - Average completion time in seconds
  - `fastest_time` (integer) - Fastest win time in seconds

  ### `matches`
  - `id` (uuid, primary key)
  - `game_mode` (text) - Type of game played
  - `player1_id` (uuid, foreign key) - First player
  - `player2_id` (uuid, foreign key) - Second player (nullable for practice)
  - `winner_id` (uuid, foreign key, nullable) - Winner of the match
  - `player1_score` (integer) - Player 1's final score
  - `player2_score` (integer, nullable) - Player 2's final score
  - `player1_time` (integer) - Player 1's completion time in seconds
  - `player2_time` (integer, nullable) - Player 2's completion time in seconds
  - `seed` (text) - Game seed for reproducibility
  - `solutions` (jsonb) - Array of solution words
  - `player1_guesses` (jsonb) - Player 1's guess history
  - `player2_guesses` (jsonb, nullable) - Player 2's guess history
  - `started_at` (timestamptz) - When match started
  - `completed_at` (timestamptz) - When match ended
  - `created_at` (timestamptz) - Record creation time

  ## 2. Security
  - Enable RLS on all tables
  - Users can read their own profile and stats
  - Users can update their own profile (username, avatar)
  - Users can view their own match history
  - Public can view other players' profiles (leaderboard functionality)
  - Only authenticated users can insert match records

  ## 3. Indexes
  - Index on profiles.username for leaderboard queries
  - Index on user_stats (user_id, game_mode) for stat lookups
  - Index on matches (player1_id, player2_id, created_at) for match history
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  level integer DEFAULT 1 NOT NULL,
  xp integer DEFAULT 0 NOT NULL,
  total_wins integer DEFAULT 0 NOT NULL,
  total_losses integer DEFAULT 0 NOT NULL,
  current_streak integer DEFAULT 0 NOT NULL,
  best_streak integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT valid_level CHECK (level >= 1),
  CONSTRAINT valid_xp CHECK (xp >= 0),
  CONSTRAINT valid_stats CHECK (total_wins >= 0 AND total_losses >= 0 AND current_streak >= 0 AND best_streak >= 0)
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_mode text NOT NULL,
  wins integer DEFAULT 0 NOT NULL,
  losses integer DEFAULT 0 NOT NULL,
  total_games integer DEFAULT 0 NOT NULL,
  best_score integer DEFAULT 0 NOT NULL,
  average_time integer DEFAULT 0 NOT NULL,
  fastest_time integer DEFAULT 0 NOT NULL,
  UNIQUE(user_id, game_mode),
  CONSTRAINT valid_game_mode CHECK (game_mode IN ('DUEL', 'MULTI_DUEL', 'GAUNTLET', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'TOURNAMENT')),
  CONSTRAINT valid_stats CHECK (wins >= 0 AND losses >= 0 AND total_games >= 0 AND best_score >= 0 AND average_time >= 0 AND fastest_time >= 0)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mode text NOT NULL,
  player1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  player1_score integer DEFAULT 0 NOT NULL,
  player2_score integer,
  player1_time integer DEFAULT 0 NOT NULL,
  player2_time integer,
  seed text NOT NULL,
  solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  player1_guesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  player2_guesses jsonb,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_game_mode CHECK (game_mode IN ('DUEL', 'MULTI_DUEL', 'GAUNTLET', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'TOURNAMENT')),
  CONSTRAINT valid_scores CHECK (player1_score >= 0 AND (player2_score IS NULL OR player2_score >= 0)),
  CONSTRAINT valid_times CHECK (player1_time >= 0 AND (player2_time IS NULL OR player2_time >= 0))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_level_xp ON profiles(level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_mode ON user_stats(user_id, game_mode);
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- User stats policies
CREATE POLICY "Users can view own stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON user_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Users can view their own matches"
  ON matches FOR SELECT
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can insert matches they're part of"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can update their own matches"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id)
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update profiles.updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();