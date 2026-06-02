import Foundation
import WordociousCore

/// Read-only data for another player's public profile — ports the queries in
/// app/profile/[id]/page.tsx (profile row, user_stats, last 10 matches, and
/// per-mode top words). All keyed by an arbitrary profile id, unlike the
/// session-scoped MatchStatsService.
enum PublicProfileService {
    /// One recent match as shown in the "Recent Matches" list.
    struct RecentMatch: Identifiable, Decodable {
        let id: String
        let game_mode: String
        let player1_id: String
        let player2_id: String?
        let winner_id: String?
        let player1_time: Double?
        let player2_time: Double?
        let created_at: String

        var isSolo: Bool { player2_id == nil }
        func isWinner(_ uid: String) -> Bool { winner_id == uid }
        func playerTime(_ uid: String) -> Int {
            Int((player1_id == uid ? player1_time : player2_time) ?? 0)
        }
        var date: Date? { parseTimestamp(created_at) }
    }

    /// One user_stats row including play_type (so the Solo/VS toggle works).
    struct StatRow: Decodable, Identifiable {
        var id: String { "\(gameMode)-\(playType)" }
        let gameMode: String
        let playType: String
        let wins: Int
        let losses: Int
        let bestScore: Int
        let fastestTime: Int
        enum CodingKeys: String, CodingKey {
            case gameMode = "game_mode"
            case playType = "play_type"
            case wins, losses
            case bestScore = "best_score"
            case fastestTime = "fastest_time"
        }
    }

    /// All user_stats rows for a player (both play_types, all modes).
    static func stats(id: String) async -> [StatRow] {
        (try? await AuthService.shared.client.from("user_stats")
            .select("game_mode, play_type, wins, losses, best_score, fastest_time")
            .eq("user_id", value: id).execute().value) ?? []
    }

    /// Fetch the public profile row (nil if not found / removed).
    static func fetchProfile(id: String) async -> Profile? {
        try? await AuthService.shared.client.from("profiles")
            .select(Profile.selectColumns).eq("id", value: id).limit(1).single().execute().value
    }

    /// Last 10 matches (solo or VS) involving this player, newest first.
    static func recentMatches(id: String) async -> [RecentMatch] {
        (try? await AuthService.shared.client.from("matches")
            .select("id, game_mode, player1_id, player2_id, winner_id, player1_time, player2_time, created_at")
            .or("player1_id.eq.\(id),player2_id.eq.\(id)")
            .order("created_at", ascending: false).limit(10)
            .execute().value) ?? []
    }

    private struct GuessesRow: Decodable { let player1_guesses: [String]?; let winner_id: String? }

    /// Top-5 most-guessed words for a given player + mode (ports fetchTopWords).
    static func topWords(userId id: String, mode: GameMode, limit: Int = 5) async -> [MatchStatsService.TopWord] {
        let rows: [GuessesRow] = (try? await AuthService.shared.client.from("matches")
            .select("player1_guesses,winner_id")
            .eq("player1_id", value: id).eq("game_mode", value: mode.rawValue)
            .order("created_at", ascending: false).limit(1000).execute().value) ?? []
        var counts = [String: (count: Int, wins: Int)]()
        for r in rows {
            guard let guesses = r.player1_guesses else { continue }
            let won = r.winner_id == id
            for w in guesses {
                let key = w.uppercased()
                var e = counts[key] ?? (0, 0)
                e.count += 1; if won { e.wins += 1 }
                counts[key] = e
            }
        }
        return counts.map { MatchStatsService.TopWord(word: $0.key, count: $0.value.count, wins: $0.value.wins) }
            .sorted { $0.count > $1.count }.prefix(limit).map { $0 }
    }
}
