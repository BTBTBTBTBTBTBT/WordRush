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
        let player1_score: Int?
        let player2_score: Int?
        let player1_time: Double?
        let player2_time: Double?
        let created_at: String
        /// True when this row was a forfeit win (opponent disconnected/abandoned).
        let forfeit: Bool?

        var isSolo: Bool { player2_id == nil }
        func opponentId(_ uid: String) -> String? {
            guard let p2 = player2_id else { return nil }
            return player1_id == uid ? p2 : player1_id
        }
        func isWinner(_ uid: String) -> Bool { winner_id == uid }
        func playerTime(_ uid: String) -> Int {
            Int((player1_id == uid ? player1_time : player2_time) ?? 0)
        }
        /// This player's guess count (score column = guesses; turns for multi-board).
        func guesses(_ uid: String) -> Int {
            (player1_id == uid ? player1_score : player2_score) ?? 0
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

    private struct MatchesEnvelope: Decodable { let matches: [RecentMatch] }

    /// Last 50 matches (solo or VS) involving this player, newest first.
    ///
    /// Fetched from the web API, NOT a direct `matches` query: that table's
    /// SELECT policy is participants-only (guess rows are private by design),
    /// so a client read of someone else's history returns zero rows — Recent
    /// Matches showed "No matches played yet" on every profile but your own.
    /// The endpoint reads server-side and returns only the sanitized columns
    /// this screen renders (no guess arrays).
    static func recentMatches(id: String) async -> [RecentMatch] {
        guard let url = URL(string: "https://wordocious.com/api/profile/\(id)/matches") else { return [] }
        guard let (data, resp) = try? await URLSession.shared.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let env = try? JSONDecoder().decode(MatchesEnvelope.self, from: data) else { return [] }
        return env.matches
    }

    private struct TopWordsEnvelope: Decodable {
        struct Row: Decodable { let word: String; let count: Int; let wins: Int }
        let topWords: [Row]
    }

    /// Top-5 most-guessed words for a given player + mode — same web endpoint
    /// story as recentMatches (participants-only RLS blanked this for other
    /// players); the server aggregates so raw guess rows never leave it.
    static func topWords(userId id: String, mode: GameMode, playType: String = "solo", limit: Int = 5) async -> [MatchStatsService.TopWord] {
        guard let url = URL(string: "https://wordocious.com/api/profile/\(id)/top-words?mode=\(mode.rawValue)&play=\(playType == "vs" ? "vs" : "solo")") else { return [] }
        guard let (data, resp) = try? await URLSession.shared.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let env = try? JSONDecoder().decode(TopWordsEnvelope.self, from: data) else { return [] }
        return env.topWords.prefix(limit).map { MatchStatsService.TopWord(word: $0.word, count: $0.count, wins: $0.wins) }
    }
    private struct NameRow: Decodable { let id: String; let username: String? }

    /// Batch-resolve usernames (VS opponents in Recent Matches — web profile parity).
    static func usernames(ids: [String]) async -> [String: String] {
        guard !ids.isEmpty else { return [:] }
        let rows: [NameRow] = (try? await AuthService.shared.client.from("profiles")
            .select("id, username").in("id", values: ids)
            .execute().value) ?? []
        return Dictionary(uniqueKeysWithValues: rows.compactMap { r in r.username.map { (r.id, $0) } })
    }

}
