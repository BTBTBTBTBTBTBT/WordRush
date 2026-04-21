export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          level: number
          xp: number
          total_wins: number
          total_losses: number
          current_streak: number
          best_streak: number
          gold_medals: number
          silver_medals: number
          bronze_medals: number
          last_played_at: string | null
          daily_login_streak: number
          best_daily_login_streak: number
          streak_shields: number
          is_pro: boolean
          pro_expires_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          pro_prompt_shown: boolean
          role: string
          is_banned: boolean
          ban_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          level?: number
          xp?: number
          total_wins?: number
          total_losses?: number
          current_streak?: number
          best_streak?: number
          gold_medals?: number
          silver_medals?: number
          bronze_medals?: number
          last_played_at?: string | null
          daily_login_streak?: number
          best_daily_login_streak?: number
          streak_shields?: number
          is_pro?: boolean
          pro_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          pro_prompt_shown?: boolean
          role?: string
          is_banned?: boolean
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          level?: number
          xp?: number
          total_wins?: number
          total_losses?: number
          current_streak?: number
          best_streak?: number
          gold_medals?: number
          silver_medals?: number
          bronze_medals?: number
          last_played_at?: string | null
          daily_login_streak?: number
          best_daily_login_streak?: number
          streak_shields?: number
          is_pro?: boolean
          pro_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          pro_prompt_shown?: boolean
          role?: string
          is_banned?: boolean
          ban_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          body: string
          type: string
          active: boolean
          starts_at: string
          expires_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          type?: string
          active?: boolean
          starts_at?: string
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          type?: string
          active?: boolean
          starts_at?: string
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      admin_audit_log: {
        Row: {
          id: string
          admin_id: string
          action: string
          target_user_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: string
          target_user_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          action?: string
          target_user_id?: string | null
          details?: Json
          created_at?: string
        }
      }
      user_stats: {
        Row: {
          id: string
          user_id: string
          game_mode: string
          play_type: string
          wins: number
          losses: number
          total_games: number
          best_score: number
          average_time: number
          fastest_time: number
        }
        Insert: {
          id?: string
          user_id: string
          game_mode: string
          play_type?: string
          wins?: number
          losses?: number
          total_games?: number
          best_score?: number
          average_time?: number
          fastest_time?: number
        }
        Update: {
          id?: string
          user_id?: string
          game_mode?: string
          play_type?: string
          wins?: number
          losses?: number
          total_games?: number
          best_score?: number
          average_time?: number
          fastest_time?: number
        }
      }
      matches: {
        Row: {
          id: string
          game_mode: string
          player1_id: string
          player2_id: string | null
          winner_id: string | null
          player1_score: number
          player2_score: number | null
          player1_time: number
          player2_time: number | null
          seed: string
          solutions: Json
          player1_guesses: Json
          player2_guesses: Json | null
          started_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          game_mode: string
          player1_id: string
          player2_id?: string | null
          winner_id?: string | null
          player1_score?: number
          player2_score?: number | null
          player1_time?: number
          player2_time?: number | null
          seed: string
          solutions?: Json
          player1_guesses?: Json
          player2_guesses?: Json | null
          started_at: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          game_mode?: string
          player1_id?: string
          player2_id?: string | null
          winner_id?: string | null
          player1_score?: number
          player2_score?: number | null
          player1_time?: number
          player2_time?: number | null
          seed?: string
          solutions?: Json
          player1_guesses?: Json
          player2_guesses?: Json | null
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
      }
      daily_seeds: {
        Row: {
          id: string
          day: string
          game_mode: string
          seed: string
          solutions: Json
          created_at: string
        }
        Insert: {
          id?: string
          day: string
          game_mode: string
          seed: string
          solutions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          day?: string
          game_mode?: string
          seed?: string
          solutions?: Json
          created_at?: string
        }
      }
      daily_results: {
        Row: {
          id: string
          user_id: string
          day: string
          game_mode: string
          play_type: string
          completed: boolean
          guess_count: number
          time_seconds: number
          boards_solved: number
          total_boards: number
          composite_score: number
          vs_wins: number
          vs_losses: number
          vs_games: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day: string
          game_mode: string
          play_type?: string
          completed?: boolean
          guess_count?: number
          time_seconds?: number
          boards_solved?: number
          total_boards?: number
          composite_score?: number
          vs_wins?: number
          vs_losses?: number
          vs_games?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day?: string
          game_mode?: string
          play_type?: string
          completed?: boolean
          guess_count?: number
          time_seconds?: number
          boards_solved?: number
          total_boards?: number
          composite_score?: number
          vs_wins?: number
          vs_losses?: number
          vs_games?: number
          created_at?: string
          updated_at?: string
        }
      }
      medals: {
        Row: {
          id: string
          user_id: string
          day: string
          game_mode: string
          play_type: string
          medal_type: string
          composite_score: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day: string
          game_mode: string
          play_type?: string
          medal_type: string
          composite_score: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day?: string
          game_mode?: string
          play_type?: string
          medal_type?: string
          composite_score?: number
          created_at?: string
        }
      }
      all_time_records: {
        Row: {
          id: string
          record_type: string
          game_mode: string | null
          play_type: string | null
          holder_id: string
          record_value: number
          achieved_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          record_type: string
          game_mode?: string | null
          play_type?: string | null
          holder_id: string
          record_value: number
          achieved_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          record_type?: string
          game_mode?: string | null
          play_type?: string | null
          holder_id?: string
          record_value?: number
          achieved_at?: string
          updated_at?: string
        }
      }
      achievements: {
        Row: {
          id: string
          user_id: string
          achievement_key: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_key: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_key?: string
          unlocked_at?: string
        }
      }
    }
  }
}
