import Foundation
import WordociousCore

/// Data layer for the public-profile "social" redesign: persona (server-computed
/// archetype/opener/percentile/nemesis), guarded solved-board fetch, and the
/// authenticated Supabase reads (daily_results / medals) that power the
/// You-vs-Them card, trophy case, highlights, streak calendar and Lately feed.
/// Everything degrades to empty — the profile page renders its existing
/// content even if every fetch here fails.
extension PublicProfileService {

    // MARK: Persona (server endpoint)

    struct Persona: Decodable {
        struct Opener: Decodable { let word: String; let count: Int; let winRate: Double? }
        struct Percentile: Decodable { let mode: String; let topPct: Double }
        struct Nemesis: Decodable { let userId: String; let username: String; let sharedBoards: Int }
        struct Flawless: Decodable { let count: Int; let pctOfPlayers: Double? }
        let archetype: String
        let opener: Opener?
        let longestWinStreak: Int?
        let bestPercentile: Percentile?
        let nemesis: Nemesis?
        let flawless: Flawless?
    }

    /// GET /api/profile/<id>/persona — nil on any failure (page still renders).
    /// Bearer header per the private-profiles contract: the endpoint 403s for
    /// a private target unless the caller proves they're the owner/an admin.
    static func persona(id: String) async -> Persona? {
        guard let url = URL(string: "https://wordocious.com/api/profile/\(id)/persona") else { return nil }
        let req = await authedRequest(url)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONDecoder().decode(Persona.self, from: data)
    }

    // MARK: Guarded solved-board fetch (server endpoint, auth'd)

    struct SolvedDailyBoard: Decodable {
        let seed: String
        let gameMode: String
        let guesses: [String]
        let solutions: [String]
        let timeSeconds: Int?
        let won: Bool?
        let hintsUsed: Int?
    }

    enum BoardFetch {
        case board(SolvedDailyBoard)
        /// 403 {locked:true} — the viewer hasn't finished that daily yet.
        case locked
        case failed
    }

    /// GET /api/profile/<id>/board?seed=daily-YYYY-MM-DD-MODE with the viewer's
    /// Supabase access token — the server enforces the one spoiler rule
    /// (boards open only for dailies the VIEWER has finished).
    static func sharedBoard(userId: String, seed: String) async -> BoardFetch {
        guard let token = try? await AuthService.shared.client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com/api/profile/\(userId)/board?seed=\(seed)")
        else { return .failed }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { return .failed }
        if http.statusCode == 403 { return .locked }
        guard http.statusCode == 200,
              let board = try? JSONDecoder().decode(SolvedDailyBoard.self, from: data) else { return .failed }
        return .board(board)
    }

    // MARK: daily_results reads (client can read any user — leaderboards do)

    struct DailyCell: Decodable {
        let day: String
        let gameMode: String
        let completed: Bool?
        let guessCount: Int?
        let timeSeconds: Int?
        let boardsSolved: Int?
        let totalBoards: Int?
        let compositeScore: Double?
        enum CodingKeys: String, CodingKey {
            case day, completed
            case gameMode = "game_mode"
            case guessCount = "guess_count"
            case timeSeconds = "time_seconds"
            case boardsSolved = "boards_solved"
            case totalBoards = "total_boards"
            case compositeScore = "composite_score"
        }
    }

    /// A player's solo daily rows, newest first (optionally since a day key).
    static func dailyRows(userId: String, sinceDay: String? = nil, limit: Int = 700) async -> [DailyCell] {
        let cols = "day, game_mode, completed, guess_count, time_seconds, boards_solved, total_boards, composite_score"
        do {
            var filter = AuthService.shared.client.from("daily_results")
                .select(cols)
                .eq("user_id", value: userId)
                .eq("play_type", value: "solo")
            if let sinceDay { filter = filter.gte("day", value: sinceDay) }
            return try await filter.order("day", ascending: false).limit(limit).execute().value
        } catch { return [] }
    }

    /// Count of dailies the target completed TODAY (0–9) — the avatar ring.
    static func todayRing(userId: String) async -> Int {
        let rows = await dailyRows(userId: userId, sinceDay: LeaderboardService.todayLocal(), limit: 20)
        return Set(rows.filter { $0.completed == true }.map(\.gameMode)).count
    }

    /// True once the player has ever solved all 8 OctoWord boards in a daily.
    static func hasPerfectOcto(userId: String) async -> Bool {
        let count = (try? await AuthService.shared.client.from("daily_results")
            .select("id", head: true, count: .exact)
            .eq("user_id", value: userId)
            .eq("game_mode", value: GameMode.octordle.rawValue)
            .eq("boards_solved", value: 8)
            .execute().count) ?? 0
        return count > 0
    }

    // MARK: Head-to-head from shared dailies

    struct SharedDaily: Identifiable {
        var id: String { "\(day)-\(mode)" }
        let day: String
        let mode: String
        let mine: DailyCell
        let theirs: DailyCell
        /// +1 viewer won, -1 target won, 0 tie (higher composite_score wins).
        var winner: Int {
            let m = mine.compositeScore ?? 0, t = theirs.compositeScore ?? 0
            if m > t { return 1 }
            if t > m { return -1 }
            return 0
        }
    }

    struct H2HSummary {
        var myWins = 0
        var theirWins = 0
        var ties = 0
        /// All shared dailies (both completed the same day+mode), newest first.
        var shared: [SharedDaily] = []
        var myAvgGuesses: Double?
        var theirAvgGuesses: Double?
        var myAvgTime: Double?
        var theirAvgTime: Double?
        var mySweeps = 0
        var theirSweeps = 0
        /// A day+mode BOTH finished today, if any — the today-compare line.
        var today: SharedDaily?
    }

    /// Joins the two players' completed solo daily_results on day+mode.
    static func h2h(viewerId: String, targetId: String) async -> H2HSummary {
        async let mineF = dailyRows(userId: viewerId)
        async let theirsF = dailyRows(userId: targetId)
        let mine = await mineF.filter { $0.completed == true }
        let theirs = await theirsF.filter { $0.completed == true }

        var summary = H2HSummary()
        var mineByKey: [String: DailyCell] = [:]
        for row in mine { mineByKey["\(row.day)|\(row.gameMode)"] = row }

        var shared: [SharedDaily] = []
        for t in theirs {
            guard let m = mineByKey["\(t.day)|\(t.gameMode)"] else { continue }
            shared.append(SharedDaily(day: t.day, mode: t.gameMode, mine: m, theirs: t))
        }
        shared.sort { $0.day == $1.day ? $0.mode < $1.mode : $0.day > $1.day }
        summary.shared = shared
        for s in shared {
            switch s.winner {
            case 1: summary.myWins += 1
            case -1: summary.theirWins += 1
            default: summary.ties += 1
            }
        }
        let today = LeaderboardService.todayLocal()
        summary.today = shared.first { $0.day == today }

        func avg(_ values: [Int]) -> Double? {
            let v = values.filter { $0 > 0 }
            return v.isEmpty ? nil : Double(v.reduce(0, +)) / Double(v.count)
        }
        summary.myAvgGuesses = avg(shared.compactMap { $0.mine.guessCount })
        summary.theirAvgGuesses = avg(shared.compactMap { $0.theirs.guessCount })
        summary.myAvgTime = avg(shared.compactMap { $0.mine.timeSeconds })
        summary.theirAvgTime = avg(shared.compactMap { $0.theirs.timeSeconds })
        summary.mySweeps = sweepCount(mine)
        summary.theirSweeps = sweepCount(theirs)
        return summary
    }

    /// Days on which a player completed all daily modes (a "sweep").
    private static func sweepCount(_ rows: [DailyCell]) -> Int {
        var modesByDay: [String: Set<String>] = [:]
        for r in rows { modesByDay[r.day, default: []].insert(r.gameMode) }
        return modesByDay.values.filter { $0.count >= MedalService.dailyModeCount }.count
    }

    // MARK: Streak calendar (60 days)

    /// day → completed-mode count over the last `days` days.
    static func streakCalendar(userId: String, days: Int = 60) async -> [String: Int] {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        let start = Calendar.current.date(byAdding: .day, value: -(days - 1), to: Date()) ?? Date()
        let rows = await dailyRows(userId: userId, sinceDay: f.string(from: start))
        var modesByDay: [String: Set<String>] = [:]
        for r in rows where r.completed == true { modesByDay[r.day, default: []].insert(r.gameMode) }
        return modesByDay.mapValues(\.count)
    }

    // MARK: Podium (medals table)

    struct PodiumEntry: Identifiable {
        let id: String
        let userId: String
        let medalType: String
        var username: String
    }

    private struct PodiumRowDecode: Decodable {
        let id: String
        let userId: String
        let medalType: String
        enum CodingKeys: String, CodingKey {
            case id
            case userId = "user_id"
            case medalType = "medal_type"
        }
    }

    /// The gold/silver/bronze winners for one day+mode, medal order.
    static func podium(day: String, mode: String) async -> [PodiumEntry] {
        let rows: [PodiumRowDecode] = (try? await AuthService.shared.client.from("medals")
            .select("id, user_id, medal_type")
            .eq("day", value: day)
            .eq("game_mode", value: mode)
            .in("medal_type", values: ["gold", "silver", "bronze"])
            .execute().value) ?? []
        let names = await usernames(ids: rows.map(\.userId))
        let order = ["gold": 0, "silver": 1, "bronze": 2]
        return rows
            .sorted { (order[$0.medalType] ?? 9) < (order[$1.medalType] ?? 9) }
            .map { PodiumEntry(id: $0.id, userId: $0.userId, medalType: $0.medalType,
                               username: names[$0.userId] ?? "Player") }
    }
}
