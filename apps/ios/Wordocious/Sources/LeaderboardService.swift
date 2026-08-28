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
    // VS-board stats (nil on older cached rows / non-VS queries) — feed the
    // "3-1 today" subline on the VS leaderboard share card.
    let vsWins: Int?
    let vsLosses: Int?
    let vsGames: Int?
    let completed: Bool
    let profiles: ProfileRef

    struct ProfileRef: Decodable {
        let username: String
        let avatarUrl: String?
        var avatarEmoji: String?   // §212: emoji avatar beats the initial on rows
        enum CodingKeys: String, CodingKey {
            case username; case avatarUrl = "avatar_url"; case avatarEmoji = "avatar_emoji"
        }
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case compositeScore = "composite_score"
        case guessCount = "guess_count"
        case timeSeconds = "time_seconds"
        case boardsSolved = "boards_solved"
        case totalBoards = "total_boards"
        case hintsUsed = "hints_used"
        case vsWins = "vs_wins"
        case vsLosses = "vs_losses"
        case vsGames = "vs_games"
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
        /// "Your neighborhood" rows when the user ranks past the top-50 list
        /// (web lbCache.win parity). Defaulted so existing call sites compile.
        var rankWindow: (startRank: Int, entries: [LeaderboardEntry])? = nil
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

    static func fetch(gameMode: GameMode, day: String? = nil, playType: String = "solo",
                      limit: Int = 50, offset: Int = 0,
                      userIds: [String]? = nil) async throws -> [LeaderboardEntry] {
        // FRIENDS (§207): `userIds` restricts the board to friends∪me; the
        // caller then dense-ranks 1..N (no holes — it's your list).
        var query = AuthService.shared.client
            .from("daily_results")
            .select("""
                user_id, composite_score, guess_count, time_seconds, boards_solved,
                total_boards, hints_used, vs_wins, vs_losses, vs_games, completed,
                profiles!inner(username, avatar_url, avatar_emoji)
                """)
            .eq("day", value: day ?? todayLocal())
            .eq("game_mode", value: gameMode.rawValue)
            .eq("play_type", value: playType)
        if let userIds, !userIds.isEmpty {
            query = query.in("user_id", values: userIds)
        }
        let rows: [LeaderboardEntry] = try await query
            .order("composite_score", ascending: false)
            // §217: time then created_at — the daily-medals cron's ordering, so
            // tied (score, time) groups are contiguous and match the podium.
            .order("time_seconds", ascending: true)
            .order("created_at", ascending: true)
            .range(from: offset, to: offset + limit - 1)
            .execute()
            .value
        // App Review 1.2: hide players the signed-in user has blocked.
        return rows.filter { !ModerationService.isBlocked($0.userId) }
    }

    /// §217: competition rank — rows tied on EXACT (score, time) share the
    /// rank of the first tied row, matching the daily-medals cron (an exact
    /// tie for first is two #1s; the next player is #3). The list must be
    /// sorted score desc, time asc — the order fetch() guarantees.
    static func competitionRank(_ list: [LeaderboardEntry], _ index: Int) -> Int {
        let me = list[index]
        let first = list.firstIndex {
            $0.compositeScore == me.compositeScore && $0.timeSeconds == me.timeSeconds
        } ?? index
        return first + 1
    }

    /// The rows AROUND the user's rank — the "your neighborhood" section shown
    /// below the top-50 list when the user placed past it (web
    /// fetchRankWindow parity). `startRank` is entries[0]'s 1-based rank; the
    /// window clamps to start after `topLimit` so it never overlaps the list.
    static func fetchRankWindow(gameMode: GameMode, playType: String = "solo", userRank: Int,
                                day: String? = nil, radius: Int = 4, topLimit: Int = 50)
        async -> (startRank: Int, entries: [LeaderboardEntry])? {
        let startRank = max(topLimit + 1, userRank - radius)
        let endRank = userRank + radius
        guard endRank >= startRank else { return nil }
        guard let entries = try? await fetch(gameMode: gameMode, day: day, playType: playType,
                                             limit: endRank - startRank + 1, offset: startRank - 1),
              !entries.isEmpty else { return nil }
        return (startRank, entries)
    }

    private struct ScoreOnly: Decodable { let composite_score: Double; let time_seconds: Int }

    /// Current user's rank for a day's daily (mirrors getUserDailyRank) —
    /// defaults to today; the leaderboard share card passes yesterday for the
    /// "▲N vs yesterday" delta pill. When `topEntries` — the already-fetched
    /// leaderboard page (and the limit it was fetched with) — is provided and
    /// the user appears in it, rank comes from their index: zero or one extra
    /// queries instead of three.
    static func userRank(gameMode: GameMode, userId: String, playType: String = "solo",
                         day dayIn: String? = nil,
                         topEntries: [LeaderboardEntry]? = nil, topLimit: Int = 50) async -> (rank: Int, total: Int)? {
        let client = AuthService.shared.client
        let day = dayIn ?? todayLocal()
        @Sendable func totalCount() async throws -> Int {
            try await client.from("daily_results")
                .select("user_id", head: true, count: .exact)
                .eq("day", value: day).eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .execute().count ?? 0
        }

        if let top = topEntries {
            if let idx = top.firstIndex(where: { $0.userId == userId }) {
                // §217: exact (score, time) ties SHARE the first tied row's rank.
                let rank = competitionRank(top, idx)
                // Under-full page → the list IS everyone; over-full needs a true total.
                if top.count < topLimit { return (rank, top.count) }
                let total = (try? await totalCount()) ?? top.count
                return (rank, total)
            }
            // Full board visible and the user isn't on it → they haven't played today.
            if top.count < topLimit { return nil }
        }

        do {
            // Outside the fetched page: user's score + total in parallel, then players ahead.
            async let mineReq: [ScoreOnly] = client.from("daily_results")
                .select("composite_score, time_seconds").eq("user_id", value: userId).eq("day", value: day)
                .eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .limit(1).execute().value
            async let totalReq = totalCount()
            let (mine, total) = try await (mineReq, totalReq)
            guard let my = mine.first else { return nil }

            // §217: strictly ahead = higher score OR same score + faster time;
            // exact (score, time) ties share the rank (daily-medals parity).
            async let aheadReq = client.from("daily_results")
                .select("user_id", head: true, count: .exact)
                .eq("day", value: day).eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .gt("composite_score", value: my.composite_score)
                .execute().count
            async let fasterTieReq = client.from("daily_results")
                .select("user_id", head: true, count: .exact)
                .eq("day", value: day).eq("game_mode", value: gameMode.rawValue).eq("play_type", value: playType)
                .eq("composite_score", value: my.composite_score)
                .lt("time_seconds", value: my.time_seconds)
                .execute().count
            let (ahead, fasterTies) = try await (aheadReq ?? 0, fasterTieReq ?? 0)
            return (ahead + fasterTies + 1, total)
        } catch { return nil }
    }

    // §223: per-mode detail behind the Sweep board's dot strip + guess/hint
    // totals. Fetched straight from daily_results for the board's users (the
    // same publicly-readable table the per-mode boards already query), so the
    // sweep RPCs never had to change shape. Mirrors fetchSweepModeDetails in
    // lib/daily-service.ts.
    struct SweepModeDetail {
        let score: Double
        let completed: Bool
    }
    struct SweepDetails {
        var modes: [String: SweepModeDetail] = [:]
        var guesses = 0
        var hints = 0
    }

    private struct SweepDetailRow: Decodable {
        let userId: String
        let gameMode: String
        let compositeScore: Double
        let completed: Bool
        let guessCount: Int?
        let hintsUsed: Int?
        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case gameMode = "game_mode"
            case compositeScore = "composite_score"
            case completed
            case guessCount = "guess_count"
            case hintsUsed = "hints_used"
        }
    }

    /// Non-throwing (web parity): the dots and g/h counts are enrichment — a
    /// failed fetch renders the plain sweep rows, never an error state.
    /// §248: current flawless-victory streaks for board users, ending at `day`.
    /// Derived from publicly-readable daily_results (daily_bonuses is
    /// own-rows-only under RLS): a day counts when the user WON the era's full
    /// mode count. 30-day window. Callers pass only rows already FLAWLESS.
    static func fetchFlawlessStreaks(day: String, userIds: [String]) async -> [String: Int] {
        guard !userIds.isEmpty else { return [:] }
        struct Row: Decodable {
            let user_id: String; let day: String; let game_mode: String
        }
        let from = MatchStatsService.shiftLocalDay(day, -29)
        let rows: [Row] = (try? await AuthService.shared.client.from("daily_results")
            .select("user_id, day, game_mode")
            .eq("play_type", value: "solo")
            .eq("completed", value: true)
            .in("user_id", values: userIds)
            .gte("day", value: from)
            .lte("day", value: day)
            .execute().value) ?? []
        var wonModes: [String: [String: Set<String>]] = [:]
        for r in rows { wonModes[r.user_id, default: [:]][r.day, default: []].insert(r.game_mode) }
        var out: [String: Int] = [:]
        for id in userIds {
            guard let byDay = wonModes[id] else { out[id] = 0; continue }
            var streak = 0
            var cursor = day
            while (byDay[cursor]?.count ?? 0) >= MatchStatsService.requiredDailyModes(cursor) {
                streak += 1
                cursor = MatchStatsService.shiftLocalDay(cursor, -1)
            }
            out[id] = streak
        }
        return out
    }

    static func fetchSweepModeDetails(day: String, userIds: [String]) async -> [String: SweepDetails] {
        guard !userIds.isEmpty else { return [:] }
        let rows: [SweepDetailRow] = (try? await AuthService.shared.client
            .from("daily_results")
            .select("user_id, game_mode, composite_score, completed, guess_count, hints_used")
            .eq("day", value: day)
            .eq("play_type", value: "solo")
            .in("user_id", values: userIds)
            .execute()
            .value) ?? []
        var out: [String: SweepDetails] = [:]
        for row in rows {
            var d = out[row.userId] ?? SweepDetails()
            d.modes[row.gameMode] = SweepModeDetail(score: row.compositeScore, completed: row.completed)
            d.guesses += row.guessCount ?? 0
            d.hints += row.hintsUsed ?? 0
            out[row.userId] = d
        }
        return out
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
