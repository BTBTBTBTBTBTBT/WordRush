-- Add play_type column to user_stats to distinguish solo vs VS stats
ALTER TABLE user_stats ADD COLUMN play_type text DEFAULT 'solo' NOT NULL;
ALTER TABLE user_stats ADD CONSTRAINT valid_play_type CHECK (play_type IN ('solo', 'vs'));

-- Drop old unique constraint and add new one including play_type
ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS user_stats_user_id_game_mode_key;
ALTER TABLE user_stats ADD CONSTRAINT user_stats_user_id_game_mode_play_type_key UNIQUE (user_id, game_mode, play_type);

-- Update index to include play_type
DROP INDEX IF EXISTS idx_user_stats_user_mode;
CREATE INDEX idx_user_stats_user_mode_type ON user_stats(user_id, game_mode, play_type);
