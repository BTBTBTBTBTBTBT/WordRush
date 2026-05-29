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

    /// Records a finished solo daily game. No-ops if signed out or the mode
    /// has no daily score config. Returns the composite score (or nil).
    @discardableResult
    static func record(
        gameMode: GameMode,
        completed: Bool,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        hintsUsed: Int = 0
    ) async -> Double? {
        guard DailyScoring.config[gameMode.rawValue] != nil else { return nil }
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return nil }
        let userId = session.user.id.uuidString

        let day = LeaderboardService.todayLocal()
        let composite = DailyScoring.compositeScore(
            gameMode: gameMode.rawValue, completed: completed, guessCount: guessCount,
            timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
            hintsUsed: hintsUsed
        )

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
            return composite
        } catch {
            return nil
        }
    }
}
