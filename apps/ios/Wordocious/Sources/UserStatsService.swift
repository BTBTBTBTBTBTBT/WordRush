import Foundation
import Supabase

/// One user_stats row (per mode + play_type).
struct UserStatRow: Decodable {
    let gameMode: String
    let playType: String
    let wins: Int
    let losses: Int
    let totalGames: Int
    let bestScore: Int
    let averageTime: Int
    let fastestTime: Int
    enum CodingKeys: String, CodingKey {
        case gameMode = "game_mode"
        case playType = "play_type"
        case wins, losses
        case totalGames = "total_games"
        case bestScore = "best_score"
        case averageTime = "average_time"
        case fastestTime = "fastest_time"
    }
}

/// Aggregated per-mode stats for one play_type (web profile filters by the
/// Solo/VS toggle).
struct ModeStats {
    var wins = 0, losses = 0, totalGames = 0, bestScore = 0, fastestTime = 0
    var winStreakCurrent = 0, winStreakBest = 0
}

enum UserStatsService {
    static func fetch(userId: String) async -> [UserStatRow] {
        (try? await AuthService.shared.client.from("user_stats")
            .select("game_mode, play_type, wins, losses, total_games, best_score, average_time, fastest_time")
            .eq("user_id", value: userId)
            .execute().value) ?? []
    }

    /// Combine the rows for one mode (callers pre-filter by play_type for the
    /// Solo/VS toggle, mirroring the web profile's filteredStats).
    static func aggregate(_ rows: [UserStatRow], mode: String) -> ModeStats {
        var s = ModeStats()
        for r in rows where r.gameMode == mode {
            s.wins += r.wins; s.losses += r.losses; s.totalGames += r.totalGames
            if r.bestScore > 0 { s.bestScore = s.bestScore == 0 ? r.bestScore : min(s.bestScore, r.bestScore) }
            if r.fastestTime > 0 { s.fastestTime = s.fastestTime == 0 ? r.fastestTime : min(s.fastestTime, r.fastestTime) }
        }
        return s
    }

    /// Aggregate VS record across all modes for the VS RECORD summary card
    /// (web profile vsRecord).
    static func vsRecord(_ rows: [UserStatRow]) -> (wins: Int, losses: Int, total: Int, winRate: Int) {
        let vsRows = rows.filter { $0.playType == "vs" }
        let wins = vsRows.reduce(0) { $0 + $1.wins }
        let losses = vsRows.reduce(0) { $0 + $1.losses }
        let total = wins + losses
        return (wins, losses, total, total > 0 ? Int((Double(wins) / Double(total) * 100).rounded()) : 0)
    }

    /// Games played per mode (dbKey → count) for the mode-picker badges.
    static func gamesPerMode(_ rows: [UserStatRow]) -> [String: Int] {
        var out: [String: Int] = [:]
        for r in rows { out[r.gameMode, default: 0] += r.totalGames }
        return out
    }
}
