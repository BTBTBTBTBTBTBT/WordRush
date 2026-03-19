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
          created_at?: string
          updated_at?: string
        }
      }
      user_stats: {
        Row: {
          id: string
          user_id: string
          game_mode: string
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
    }
  }
}
