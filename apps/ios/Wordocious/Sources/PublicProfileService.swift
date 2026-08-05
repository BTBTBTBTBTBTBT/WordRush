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

    // MARK: Private-profiles gate plumbing

    /// PRIVATE PROFILES: the four /api/profile/[id]/* endpoints identify the
    /// caller by `Authorization: Bearer <access token>` and 403 when the
    /// target is private and the caller isn't the owner or an admin. The
    /// header is optional (anonymous viewers of public profiles still get
    /// data) but MUST be sent whenever a session exists — without it the
    /// OWNER of a private profile is gated out of their own deep stats
    /// (matches on the profile tab, top words, persona).
    /// Mirrors web profileApiHeaders() in lib/profile-social.ts.
    static func authedRequest(_ url: URL) async -> URLRequest {
        var req = URLRequest(url: url)
        if let token = try? await AuthService.shared.client.auth.session.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    /// The gate's typed 403 body: { "error": "This profile is private",
    /// "private": true }. Branch on `private`, never string-match the error.
    private struct PrivateGateBody: Decodable { let `private`: Bool? }

    /// True iff a response is the private-profile 403 (not the board route's
    /// {locked:true} 403 or any other failure).
    static func isPrivateGate(_ resp: URLResponse?, _ data: Data?) -> Bool {
        guard (resp as? HTTPURLResponse)?.statusCode == 403, let data,
              let body = try? JSONDecoder().decode(PrivateGateBody.self, from: data)
        else { return false }
        return body.private == true
    }

    /// A deep-endpoint fetch that can be refused by the privacy gate.
    enum Gated<T> {
        case ok(T)
        /// Typed 403 {private:true} — the caller must show the teaser card.
        case privateProfile
        case failed
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
    static func recentMatchesGated(id: String) async -> Gated<[RecentMatch]> {
        guard let url = URL(string: "https://wordocious.com/api/profile/\(id)/matches") else { return .failed }
        let req = await authedRequest(url)
        guard let (data, resp) = try? await URLSession.shared.data(for: req) else { return .failed }
        if isPrivateGate(resp, data) { return .privateProfile }
        guard (resp as? HTTPURLResponse)?.statusCode == 200,
              let env = try? JSONDecoder().decode(MatchesEnvelope.self, from: data) else { return .failed }
        return .ok(env.matches)
    }

    /// Array-shaped convenience for callers that treat every failure as empty
    /// (the own-profile tab — the bearer header means the owner of a private
    /// profile still gets rows there).
    static func recentMatches(id: String) async -> [RecentMatch] {
        if case .ok(let rows) = await recentMatchesGated(id: id) { return rows }
        return []
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
        let req = await authedRequest(url)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
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
