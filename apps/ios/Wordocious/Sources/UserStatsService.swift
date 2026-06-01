import Foundation
import Supabase

/// One user_stats row (per mode + play_type).
struct UserStatRow: Decodable {
    let gameMode: String
    let wins: Int
    let losses: Int
    let totalGames: Int
    let bestScore: Int
    let averageTime: Int
    let fastestTime: Int
    enum CodingKeys: String, CodingKey {
        case gameMode = "game_mode"
        case wins, losses
        case totalGames = "total_games"
        case bestScore = "best_score"
        case averageTime = "average_time"
        case fastestTime = "fastest_time"
    }
}

/// Aggregated per-mode stats (solo + vs combined, mirroring the web profile).
struct ModeStats {
    var wins = 0, losses = 0, totalGames = 0, bestScore = 0, fastestTime = 0
    var winStreakCurrent = 0, winStreakBest = 0
}

enum UserStatsService {
    static func fetch(userId: String) async -> [UserStatRow] {
        (try? await AuthService.shared.client.from("user_stats")
            .select("game_mode, wins, losses, total_games, best_score, average_time, fastest_time")
            .eq("user_id", value: userId)
            .execute().value) ?? []
    }

    /// Combine solo+vs rows for one mode (matches the web "combined" view).
    static func aggregate(_ rows: [UserStatRow], mode: String) -> ModeStats {
        var s = ModeStats()
        for r in rows where r.gameMode == mode {
            s.wins += r.wins; s.losses += r.losses; s.totalGames += r.totalGames
            if r.bestScore > 0 { s.bestScore = s.bestScore == 0 ? r.bestScore : min(s.bestScore, r.bestScore) }
            if r.fastestTime > 0 { s.fastestTime = s.fastestTime == 0 ? r.fastestTime : min(s.fastestTime, r.fastestTime) }
        }
        return s
    }

    /// Games played per mode (dbKey → count) for the mode-picker badges.
    static func gamesPerMode(_ rows: [UserStatRow]) -> [String: Int] {
        var out: [String: Int] = [:]
        for r in rows { out[r.gameMode, default: 0] += r.totalGames }
        return out
    }
}
