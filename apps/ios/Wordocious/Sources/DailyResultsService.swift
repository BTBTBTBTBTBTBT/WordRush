import Foundation
import Supabase
import WordociousCore

/// Writes solo daily results to Supabase `daily_results`, mirroring
/// lib/daily-service.ts recordDailyResult() — keyed by user+day+mode+play_type,
/// inserts new or updates only when the new composite score beats the old.
/// Requires an authenticated session (RLS: insert/update gated to auth.uid()).
enum DailyResultsService {
    private struct ExistingRow: Decodable {
        let id: String
        let compositeScore: Double
        enum CodingKeys: String, CodingKey { case id; case compositeScore = "composite_score" }
    }

    private struct ResultInsert: Encodable {
        let user_id: String
        let day: String
        let game_mode: String
        let play_type: String
        let completed: Bool
        let guess_count: Int
        let time_seconds: Int
        let boards_solved: Int
        let total_boards: Int
        let composite_score: Double
        let hints_used: Int
    }

    private struct ResultUpdate: Encodable {
        let completed: Bool
        let guess_count: Int
        let time_seconds: Int
        let boards_solved: Int
        let total_boards: Int
        let composite_score: Double
        let hints_used: Int
    }

    /// Has the (free) user already used today's daily Classic VS? Mirrors the
    /// web `hasPlayedModeToday('vs')` gate — a daily_results row for DUEL/vs today.
    static func hasPlayedDailyVS() async -> Bool {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return false }
        let count = (try? await client.from("daily_results")
            .select("id", head: true, count: .exact)
            .eq("user_id", value: uid).eq("day", value: LeaderboardService.todayLocal())
            .eq("game_mode", value: "DUEL").eq("play_type", value: "vs")
            .execute().count) ?? 0
        return count > 0
    }

    /// Today's daily Classic VS outcome for the home card badge: true=won,
    /// false=lost, nil if not played yet. (One shared daily VS per day, so a
    /// single win/loss.)
    static func dailyVSResult() async -> Bool? {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return nil }
        let rows: [VsRow] = (try? await client.from("daily_results")
            .select("id, vs_wins, vs_losses, vs_games")
            .eq("user_id", value: uid).eq("day", value: LeaderboardService.todayLocal())
            .eq("game_mode", value: "DUEL").eq("play_type", value: "vs")
            .limit(1).execute().value) ?? []
        guard let row = rows.first else { return nil }
        return row.vsWins > 0
    }

    private struct VsRow: Decodable {
        let id: String; let vsWins: Int; let vsLosses: Int; let vsGames: Int
        enum CodingKeys: String, CodingKey {
            case id; case vsWins = "vs_wins"; case vsLosses = "vs_losses"; case vsGames = "vs_games"
        }
    }
    private struct VsInsert: Encodable {
        let user_id: String; let day: String; let game_mode: String; let play_type: String
        let completed: Bool; let vs_wins: Int; let vs_losses: Int; let vs_games: Int; let composite_score: Double
    }
    private struct VsUpdate: Encodable {
        let vs_wins: Int; let vs_losses: Int; let vs_games: Int; let composite_score: Double; let completed: Bool
    }

    /// Mirrors lib/daily-service.ts calculateVsCompositeScore — needs ≥3 games to
    /// qualify; rewards win count, win rate, and volume.
    static func vsCompositeScore(wins: Int, losses: Int, games: Int) -> Double {
        // No minimum-games floor (freemium = 1 VS/day; volume terms still rank multi-game players higher).
        let winRate = Double(wins) / Double(max(1, games))
        return (((Double(wins) * 100) + (winRate * 50) + (Double(games) * 5)) * 100).rounded() / 100
    }

    /// Records a finished daily Classic VS result into `daily_results`
    /// (play_type='vs'), mirroring lib/daily-service.ts recordDailyVsResult():
    /// upserts vs_wins/vs_losses/vs_games + a VS composite score so the player
    /// appears on the VS daily leaderboard and the 3-wins-a-day achievement can
    /// fire. Keyed by user+day+mode+play_type='vs'. Requires an auth session.
    static func recordVs(gameMode: GameMode, won: Bool) async {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString
        let day = LeaderboardService.todayLocal()
        do {
            let existing: [VsRow] = try await client.from("daily_results")
                .select("id, vs_wins, vs_losses, vs_games")
                .eq("user_id", value: userId)
                .eq("day", value: day)
                .eq("game_mode", value: gameMode.rawValue)
                .eq("play_type", value: "vs")
                .limit(1)
                .execute().value

            if let row = existing.first {
                let w = row.vsWins + (won ? 1 : 0)
                let l = row.vsLosses + (won ? 0 : 1)
                let g = row.vsGames + 1
                let update = VsUpdate(vs_wins: w, vs_losses: l, vs_games: g,
                                      composite_score: vsCompositeScore(wins: w, losses: l, games: g),
                                      completed: true)
                try await client.from("daily_results").update(update).eq("id", value: row.id).execute()
            } else {
                let w = won ? 1 : 0
                let l = won ? 0 : 1
                let insert = VsInsert(user_id: userId, day: day, game_mode: gameMode.rawValue,
                                      play_type: "vs", completed: true, vs_wins: w, vs_losses: l,
                                      vs_games: 1, composite_score: vsCompositeScore(wins: w, losses: l, games: 1))
                try await client.from("daily_results").insert(insert).execute()
            }
        } catch {}
    }

    /// Records a finished solo daily game. No-ops if signed out or the mode
    /// has no daily score config. Returns the composite score (or nil).
    ///
    /// `seed`: the game's seed (`daily-YYYY-MM-DD-MODE`). The row's `day` is
    /// derived from it so a daily started at 23:58 and finished at 00:02 still
    /// records onto the day it belongs to, not "today at finish time". Falls
    /// back to todayLocal() when the seed is missing/unparseable.
    @discardableResult
    static func record(
        gameMode: GameMode,
        completed: Bool,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        hintsUsed: Int = 0,
        seed: String? = nil
    ) async -> Double? {
        guard DailyScoring.config[gameMode.rawValue] != nil else { return nil }
        // The puzzle's calendar day comes from the seed, NOT the finish time.
        let day = seed.flatMap(getDailySeedDate) ?? LeaderboardService.todayLocal()
        let composite = DailyScoring.compositeScore(
            gameMode: gameMode.rawValue, completed: completed, guessCount: guessCount,
            timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
            hintsUsed: hintsUsed
        )
        // Optimistic local update FIRST (before any network) so the home grid's
        // completed state flips the instant the game ends (web parity: the
        // 'daily-completion' window event). Only when the row is for TODAY —
        // a cross-midnight finish records onto yesterday and must not mark
        // today's (different) puzzle complete.
        if day == LeaderboardService.todayLocal() {
            await MainActor.run {
                NotificationCenter.default.post(
                    name: DailyCompletionsStore.completionPosted,
                    object: DailyCompletion(
                        gameMode: gameMode.rawValue, completed: completed,
                        guessCount: guessCount, timeSeconds: Double(timeSeconds),
                        score: composite))
            }
        }
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return nil }
        let userId = session.user.id.uuidString

        do {
            let existing: [ExistingRow] = try await client.from("daily_results")
                .select("id, composite_score")
                .eq("user_id", value: userId)
                .eq("day", value: day)
                .eq("game_mode", value: gameMode.rawValue)
                .eq("play_type", value: "solo")
                .limit(1)
                .execute().value

            if let row = existing.first {
                if composite > row.compositeScore {
                    let update = ResultUpdate(
                        completed: completed, guess_count: guessCount, time_seconds: timeSeconds,
                        boards_solved: boardsSolved, total_boards: totalBoards,
                        composite_score: composite, hints_used: hintsUsed
                    )
                    try await client.from("daily_results").update(update).eq("id", value: row.id).execute()
                }
            } else {
                let insert = ResultInsert(
                    user_id: userId, day: day, game_mode: gameMode.rawValue, play_type: "solo",
                    completed: completed, guess_count: guessCount, time_seconds: timeSeconds,
                    boards_solved: boardsSolved, total_boards: totalBoards,
                    composite_score: composite, hints_used: hintsUsed
                )
                try await client.from("daily_results").insert(insert).execute()
            }
            // Award streak-milestone + perfect-game medals (web recordDailyResult parity).
            await MedalService.awardStreakMedals(client, userId: userId, day: day)
            await MedalService.awardPerfectMedal(client, userId: userId, gameMode: gameMode.rawValue,
                                                 day: day, guessCount: guessCount,
                                                 boardsSolved: boardsSolved, totalBoards: totalBoards,
                                                 completed: completed)
            return composite
        } catch {
            return nil
        }
    }
}
