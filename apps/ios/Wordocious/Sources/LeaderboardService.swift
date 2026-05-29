import Foundation
import Supabase
import WordociousCore

struct LeaderboardEntry: Identifiable, Decodable {
    var id: String { userId }
    let userId: String
    let compositeScore: Double
    let guessCount: Int
    let timeSeconds: Double
    let boardsSolved: Int
    let totalBoards: Int
    let hintsUsed: Int?
    let completed: Bool
    let profiles: ProfileRef

    struct ProfileRef: Decodable {
        let username: String
        let avatarUrl: String?
        enum CodingKeys: String, CodingKey { case username; case avatarUrl = "avatar_url" }
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case compositeScore = "composite_score"
        case guessCount = "guess_count"
        case timeSeconds = "time_seconds"
        case boardsSolved = "boards_solved"
        case totalBoards = "total_boards"
        case hintsUsed = "hints_used"
        case completed
        case profiles
    }

    var username: String { profiles.username }
}

/// Reads the daily leaderboard from `daily_results`, mirroring
/// lib/daily-service.ts getDailyLeaderboard() exactly (same columns, filters,
/// ordering). `day` is the device-LOCAL date (matches web getTodayLocal()).
enum LeaderboardService {
    static func todayLocal() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    static func fetch(gameMode: GameMode, playType: String = "solo", limit: Int = 50) async throws -> [LeaderboardEntry] {
        try await AuthService.shared.client
            .from("daily_results")
            .select("""
                user_id, composite_score, guess_count, time_seconds, boards_solved,
                total_boards, hints_used, vs_wins, vs_games, completed,
                profiles!inner(username, avatar_url)
                """)
            .eq("day", value: todayLocal())
            .eq("game_mode", value: gameMode.rawValue)
            .eq("play_type", value: playType)
            .order("composite_score", ascending: false)
            .order("created_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }
}
