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

/// Session-lived stale-while-revalidate cache, keyed mode:day:user — mirrors
/// web lbCache in app/daily/page.tsx. A mode-chip tap or a tab return paints
/// the last-known rows instantly while the fresh fetch swaps in silently, so
/// the skeleton only ever shows on a true first load. The local-day key
/// self-invalidates at midnight.
@MainActor
final class LeaderboardCache {
    static let shared = LeaderboardCache()
    struct Snapshot {
        let entries: [LeaderboardEntry]
        let playerCount: Int
        let userRank: (rank: Int, total: Int)?
    }
    private var store: [String: Snapshot] = [:]
    private init() {}

    static func key(mode: GameMode, userId: String?, playType: String = "solo") -> String {
        // playType defaults to "solo" so the daily-leaderboard call sites keep
        // compiling unchanged; Records passes its Solo|VS toggle value so the
        // two play types never overwrite each other's snapshot.
        "\(mode.rawValue):\(LeaderboardService.todayLocal()):\(userId ?? "anon"):\(playType)"
    }

    subscript(key: String) -> Snapshot? {
        get { store[key] }
        set { store[key] = newValue }
    }
}

/// Reads the daily leaderboard from `daily_results`, mirroring
/// lib/daily-service.ts getDailyLeaderboard() exactly (same columns, filters,
/// ordering). `day` is the device-LOCAL date (matches web getTodayLocal()).
enum LeaderboardService {
    static func todayLocal() -> String {
        // en_US_POSIX + Gregorian: without these, devices on the Buddhist or
        // Japanese calendar render yyyy as e.g. 2569 — wrong daily seed, split
        // leaderboards, broken streak comparisons.
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    /// UTC date string — used ONLY for daily-VS matchmaking so players in
    /// different timezones share one queue bucket (mirrors web getTodayUTC).
    /// Solo daily puzzles stay on the local date (todayLocal).
    static func todayUTC() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: Date())
    }

    static func yesterdayLocal() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        return f.string(from: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date())
    }

    static func fetch(gameMode: GameMode, day: String? = nil, playType: String = "solo", limit: Int = 50) async throws -> [LeaderboardEntry] {
        try await AuthService.shared.client
            .from("daily_results")
            .select("""
                user_id, composite_score, guess_count, time_seconds, boards_solved,
                total_boards, hints_used, vs_wins, vs_games, completed,
                profiles!inner(username, avatar_url)
                """)
            .eq("day", value: day ?? todayLocal())
            .eq("game_mode", value: gameMode.rawValue)
            .eq("play_type", value: playType)
            .order("composite_score", ascending: false)
            .order("created_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    private struct ScoreOnly: Decodable { let composite_score: Double }

    /// Current user's rank for today's daily (mirrors getUserDailyRank).
    /// When `topEntries` — the already-fetched leaderboard page (and the limit
    /// it was fetched with) — is provided and the user appears in it, rank
    /// comes from their index: zero or one extra queries instead of three.
    static func userRank(gameMode: GameMode, userId: String, playType: String = "solo",
                         topEntries: [LeaderboardEntry]? = nil, topLimit: Int = 50) async -> (rank: Int, total: Int)? {
        let client = AuthService.shared.client
        let day = todayLocal()
        func totalCount() async throws -> Int {
            try await client.from("daily_results")
                .select("user_id", head: true, count: .exact)
                .eq("day", value: day).eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .execute().count ?? 0
        }

        if let top = topEntries {
            if let idx = top.firstIndex(where: { $0.userId == userId }) {
                // Under-full page → the list IS everyone; over-full needs a true total.
                if top.count < topLimit { return (idx + 1, top.count) }
                let total = (try? await totalCount()) ?? top.count
                return (idx + 1, total)
            }
            // Full board visible and the user isn't on it → they haven't played today.
            if top.count < topLimit { return nil }
        }

        do {
            // Outside the fetched page: user's score + total in parallel, then players ahead.
            async let mineReq: [ScoreOnly] = client.from("daily_results")
                .select("composite_score").eq("user_id", value: userId).eq("day", value: day)
                .eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .limit(1).execute().value
            async let totalReq = totalCount()
            let (mine, total) = try await (mineReq, totalReq)
            guard let myScore = mine.first?.composite_score else { return nil }

            let ahead = try await client.from("daily_results")
                .select("user_id", head: true, count: .exact)
                .eq("day", value: day).eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .gt("composite_score", value: myScore)
                .execute().count ?? 0
            return (ahead + 1, total)
        } catch { return nil }
    }

    /// Distinct players who attempted this mode today, ALL play types (solo + VS) —
    /// matches web getDailyPlayerCount (no play_type filter), which intentionally
    /// differs from the solo-only leaderboard "of N" total.
    static func playerCount(gameMode: GameMode) async -> Int {
        let client = AuthService.shared.client
        return (try? await client.from("daily_results")
            .select("user_id", head: true, count: .exact)
            .eq("day", value: todayLocal()).eq("game_mode", value: gameMode.rawValue)
            .execute().count) ?? 0
    }
}
