import Foundation
import Supabase
import WordociousCore

/// A daily-sweep leaderboard row — players who completed all 9 daily modes that
/// day, ranked by total composite score (desc), total time (asc). Mirrors the
/// `daily_sweep_leaderboard` RPC contract.
struct SweepEntry: Identifiable, Decodable {
    var id: String { userId }
    let userId: String
    let username: String
    let avatarUrl: String?
    let totalScore: Double
    let totalTime: Int
    let modesWon: Int
    let isFlawless: Bool
    let rank: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case avatarUrl = "avatar_url"
        case totalScore = "total_score"
        case totalTime = "total_time"
        case modesWon = "modes_won"
        case isFlawless = "is_flawless"
        case rank
    }
}

/// An all-time sweep-ranking row — players ranked by lifetime sweep count.
/// Mirrors the `alltime_sweep_leaderboard` RPC contract.
struct AllTimeSweepEntry: Identifiable, Decodable {
    var id: String { userId }
    let userId: String
    let username: String
    let avatarUrl: String?
    let sweepCount: Int
    let flawlessCount: Int
    let bestSweepTime: Int
    let rank: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case avatarUrl = "avatar_url"
        case sweepCount = "sweep_count"
        case flawlessCount = "flawless_count"
        case bestSweepTime = "best_sweep_time"
        case rank
    }
}

/// The user's rank within a sweep ranking (empty when they didn't sweep).
struct SweepRank: Decodable {
    let rank: Int
    let totalPlayers: Int

    enum CodingKeys: String, CodingKey {
        case rank
        case totalPlayers = "total_players"
    }
}

/// Session-lived stale-while-revalidate cache for the sweep boards, mirroring
/// LeaderboardCache: a chip tap or tab return paints the last-known rows
/// instantly while the fresh fetch swaps in silently. The daily snapshot is
/// keyed "sweep:<local-day>" so it self-invalidates at midnight; the all-time
/// snapshot has no day dimension.
@MainActor
final class SweepCache {
    static let shared = SweepCache()
    struct DailySnapshot {
        let entries: [SweepEntry]
        let userRank: (rank: Int, total: Int)?
    }
    struct AllTimeSnapshot {
        let entries: [AllTimeSweepEntry]
        let userRank: (rank: Int, total: Int)?
    }
    private var dailyStore: [String: DailySnapshot] = [:]
    private var allTimeStore: AllTimeSnapshot?
    private init() {}

    static func dailyKey(_ day: String? = nil) -> String {
        "sweep:\(day ?? LeaderboardService.todayLocal())"
    }
    func daily(_ key: String) -> DailySnapshot? { dailyStore[key] }
    func setDaily(_ key: String, _ snap: DailySnapshot) { dailyStore[key] = snap }
    var allTime: AllTimeSnapshot? {
        get { allTimeStore }
        set { allTimeStore = newValue }
    }
}

/// Reads the daily + all-time sweep leaderboards via the sweep RPCs, mirroring
/// LeaderboardService's structure (fetch / userRank / LeaderboardCache pattern).
/// `day` is the device-LOCAL date (matches LeaderboardService.todayLocal()).
enum SweepLeaderboardService {
    // MARK: RPC param structs (Encodable → JSON function arguments)

    private struct DayParams: Encodable {
        let p_day: String
        let p_limit: Int
        let p_offset: Int
    }
    private struct DayRankParams: Encodable {
        let p_day: String
        let p_user: String
    }
    private struct AllTimeParams: Encodable {
        let p_limit: Int
        let p_offset: Int
    }
    private struct UserParams: Encodable {
        let p_user: String
    }

    // MARK: Daily sweep

    static func fetchDailySweep(day: String? = nil, limit: Int = 50, offset: Int = 0)
        async throws -> [SweepEntry] {
        let rows: [SweepEntry] = try await AuthService.shared.client
            .rpc("daily_sweep_leaderboard",
                 params: DayParams(p_day: day ?? LeaderboardService.todayLocal(),
                                   p_limit: limit, p_offset: offset))
            .execute()
            .value
        // App Review 1.2: hide players the signed-in user has blocked (parity
        // with the per-mode board's client-side filter).
        return rows.filter { !ModerationService.isBlocked($0.userId) }
    }

    static func dailySweepRank(day: String? = nil, userId: String) async -> (rank: Int, total: Int)? {
        let rows: [SweepRank]? = try? await AuthService.shared.client
            .rpc("daily_sweep_rank",
                 params: DayRankParams(p_day: day ?? LeaderboardService.todayLocal(), p_user: userId))
            .execute()
            .value
        guard let r = rows?.first else { return nil }
        return (r.rank, r.totalPlayers)
    }

    // MARK: All-time sweep

    static func fetchAllTimeSweep(limit: Int = 50, offset: Int = 0) async throws -> [AllTimeSweepEntry] {
        let rows: [AllTimeSweepEntry] = try await AuthService.shared.client
            .rpc("alltime_sweep_leaderboard", params: AllTimeParams(p_limit: limit, p_offset: offset))
            .execute()
            .value
        return rows.filter { !ModerationService.isBlocked($0.userId) }
    }

    static func allTimeSweepRank(userId: String) async -> (rank: Int, total: Int)? {
        let rows: [SweepRank]? = try? await AuthService.shared.client
            .rpc("alltime_sweep_rank", params: UserParams(p_user: userId))
            .execute()
            .value
        guard let r = rows?.first else { return nil }
        return (r.rank, r.totalPlayers)
    }
}
