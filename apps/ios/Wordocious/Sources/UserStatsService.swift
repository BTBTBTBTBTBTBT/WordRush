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
    // Null-tolerant decode: best_score/average_time/fastest_time can be NULL in
    // user_stats (modes with no recorded time, post-reconcile rows). A strict
    // non-optional Int decode throws on NULL and — via `try?` in fetch() — drops
    // the ENTIRE result set to [], which silently emptied the Pro Stats charts
    // (and any other user_stats-derived UI). Default every numeric field to 0.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gameMode = try c.decodeIfPresent(String.self, forKey: .gameMode) ?? ""
        playType = try c.decodeIfPresent(String.self, forKey: .playType) ?? "solo"
        wins = try c.decodeIfPresent(Int.self, forKey: .wins) ?? 0
        losses = try c.decodeIfPresent(Int.self, forKey: .losses) ?? 0
        totalGames = try c.decodeIfPresent(Int.self, forKey: .totalGames) ?? 0
        bestScore = try c.decodeIfPresent(Int.self, forKey: .bestScore) ?? 0
        averageTime = try c.decodeIfPresent(Int.self, forKey: .averageTime) ?? 0
        fastestTime = try c.decodeIfPresent(Int.self, forKey: .fastestTime) ?? 0
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

    /// Practice record vs the CPU (play_type='vs_cpu') — separate, unranked.
    static func cpuRecord(_ rows: [UserStatRow]) -> (wins: Int, losses: Int, total: Int, winRate: Int) {
        let cpuRows = rows.filter { $0.playType == "vs_cpu" }
        let wins = cpuRows.reduce(0) { $0 + $1.wins }
        let losses = cpuRows.reduce(0) { $0 + $1.losses }
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
