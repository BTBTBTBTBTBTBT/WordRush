import Foundation
import Supabase
import WordociousCore

/// Swift ports of the restat R1/R4 fetchers in lib/stats-service.ts:
/// Opener Lab, Weekday Form, today's daily standing, and the Pro Insights deep
/// layer (opener yield, position accuracy, word almanac, gauntlet stages,
/// hint honesty, skill radar, rivalries). All data derives from stored guess
/// logs (matches.player1/2_guesses + solutions), hints_used, gauntlet_stages —
/// evaluated client-side with the engine's evaluateGuess, exactly like the web.
enum StatsDeepService {

    private static var client: SupabaseClient { AuthService.shared.client }

    private static func userId() async -> String? {
        (try? await client.auth.session.user.id.uuidString)?.lowercased()
    }

    /// Length-guarded evaluation — the Swift evaluator traps on length
    /// mismatch (web safeEval wraps in try/catch for the same reason).
    static func safeEval(solution: String, guess: String) -> [TileState]? {
        let s = solution.uppercased(), g = guess.uppercased()
        guard !s.isEmpty, s.count == g.count else { return nil }
        return evaluateGuess(solution: s, guess: g).tiles.map(\.state)
    }

    // MARK: - Shared guess-row loader (web fetchMyGuessRows)

    struct GuessRow {
        let guesses: [String]
        let solutions: [String]
        let won: Bool
        let time: Int
        let createdAt: String
        let gameMode: String
        let hintsUsed: Int
    }

    private struct MatchRow: Decodable {
        let player1_id: String
        let player1_guesses: [String]?
        let player2_guesses: [String]?
        let solutions: [String]?
        let winner_id: String?
        let player1_time: Double?
        let player2_time: Double?
        let created_at: String
        let game_mode: String
        let hints_used: Int?
    }

    /// Rows of (my guesses, solutions, won, time) for a mode — shared loader.
    /// Play-type-scoped (restat B1): solo = player2_id null, vs = not null;
    /// vs_cpu callers early-return (CPU games never write match rows).
    static func myGuessRows(gameMode: String? = nil, limit: Int = 400, playType: String = "solo") async -> [GuessRow] {
        guard let uid = await userId() else { return [] }
        var q = client.from("matches")
            .select("player1_id, player1_guesses, player2_guesses, solutions, winner_id, player1_time, player2_time, created_at, game_mode, hints_used")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .not("solutions", operator: .is, value: "null")
        q = MatchStatsService.scopeToPlayType(q, playType)
        if let gameMode { q = q.eq("game_mode", value: gameMode) }
        let rows: [MatchRow] = (try? await q.order("created_at", ascending: false).limit(limit).execute().value) ?? []
        return rows.compactMap { r in
            let mine = (r.player1_id == uid ? r.player1_guesses : r.player2_guesses) ?? []
            let sols = r.solutions ?? []
            guard !mine.isEmpty, !sols.isEmpty else { return nil }
            let t = (r.player1_id == uid ? r.player1_time : r.player2_time) ?? 0
            return GuessRow(guesses: mine, solutions: sols, won: r.winner_id == uid,
                            time: Int(t.rounded()), createdAt: r.created_at,
                            gameMode: r.game_mode, hintsUsed: r.hints_used ?? 0)
        }
    }

    // MARK: - Opener Lab (basic — web fetchOpenerStats)

    struct OpenerStat: Identifiable {
        let word: String
        let count: Int
        let wins: Int
        let winRate: Int   // 0–100
        var id: String { word }
    }

    /// Most-used STARTING words and how often games opened with them were won.
    static func openerStats(limit: Int = 5, playType: String = "solo") async -> [OpenerStat] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        struct Row: Decodable {
            let player1_id: String
            let player1_guesses: [String]?
            let player2_guesses: [String]?
            let winner_id: String?
        }
        var q = client.from("matches")
            .select("player1_id, player1_guesses, player2_guesses, winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .not("player1_guesses", operator: .is, value: "null")
        q = MatchStatsService.scopeToPlayType(q, playType)
        let rows: [Row] = (try? await q
            .order("created_at", ascending: false)
            .limit(1000).execute().value) ?? []
        var map: [String: (count: Int, wins: Int)] = [:]
        for r in rows {
            let guesses = (r.player1_id == uid ? r.player1_guesses : r.player2_guesses) ?? []
            guard let first = guesses.first else { continue }
            let opener = first.uppercased()
            var e = map[opener] ?? (0, 0)
            e.count += 1
            if r.winner_id == uid { e.wins += 1 }
            map[opener] = e
        }
        return map.map { OpenerStat(word: $0.key, count: $0.value.count, wins: $0.value.wins,
                                    winRate: Int((Double($0.value.wins) / Double($0.value.count) * 100).rounded())) }
            .sorted { $0.count > $1.count }
            .prefix(limit).map { $0 }
    }

    // MARK: - Weekday form (web fetchWeekdayForm)

    struct WeekdayFormDay: Identifiable {
        let dow: Int   // 0 = Sunday … 6 = Saturday, LOCAL time
        var played: Int
        var won: Int
        var id: Int { dow }
    }

    /// Win rate by LOCAL day of week (last 500 games) — "your best day" card.
    static func weekdayForm(playType: String = "solo") async -> [WeekdayFormDay] {
        var days = (0..<7).map { WeekdayFormDay(dow: $0, played: 0, won: 0) }
        if playType == "vs_cpu" { return days }
        guard let uid = await userId() else { return [] }
        struct Row: Decodable { let winner_id: String?; let created_at: String }
        var q = client.from("matches")
            .select("player1_id, winner_id, created_at")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
        q = MatchStatsService.scopeToPlayType(q, playType)
        let rows: [Row] = (try? await q
            .order("created_at", ascending: false)
            .limit(500).execute().value) ?? []
        let cal = Calendar.current
        for r in rows {
            guard let d = parseTimestamp(r.created_at) else { continue }
            let dow = cal.component(.weekday, from: d) - 1   // 1=Sun → 0
            days[dow].played += 1
            if r.winner_id == uid { days[dow].won += 1 }
        }
        return days
    }

    // MARK: - Today's daily standing (web fetchTodayDailyStanding)

    struct DailyStanding {
        /// Average top-percentile across today's played dailies (1 = top 1%).
        let topPercent: Int
        let modesCounted: Int
    }

    /// Where the user's daily composite scores sit in today's field, averaged
    /// across the modes they've played today.
    static func todayDailyStanding() async -> DailyStanding? {
        guard let uid = await userId() else { return nil }
        let day = LeaderboardService.todayLocal()
        struct Mine: Decodable { let game_mode: String; let composite_score: Double? }
        struct Field: Decodable { let composite_score: Double? }
        let mine: [Mine] = (try? await client.from("daily_results")
            .select("game_mode, composite_score")
            .eq("user_id", value: uid).eq("day", value: day).eq("play_type", value: "solo")
            .execute().value) ?? []
        guard !mine.isEmpty else { return nil }
        var percentiles: [Int] = []
        for row in mine {
            guard let myScore = row.composite_score else { continue }
            let field: [Field] = (try? await client.from("daily_results")
                .select("composite_score")
                .eq("day", value: day).eq("game_mode", value: row.game_mode).eq("play_type", value: "solo")
                .limit(2000).execute().value) ?? []
            guard field.count >= 2 else { continue }
            let better = field.filter { ($0.composite_score ?? 0) > myScore }.count
            percentiles.append(max(1, Int((Double(better + 1) / Double(field.count) * 100).rounded())))
        }
        guard !percentiles.isEmpty else { return nil }
        return DailyStanding(
            topPercent: Int((Double(percentiles.reduce(0, +)) / Double(percentiles.count)).rounded()),
            modesCounted: percentiles.count)
    }

    // MARK: - Opener yield (web fetchOpenerDeep)

    struct OpenerDeepStat: Identifiable {
        let word: String
        let count: Int
        let avgGreens: Double
        let avgYellows: Double
        let winRate: Int   // 0–100
        var id: String { word }
    }

    /// Info yield of each starting word — avg greens/yellows on guess 1.
    static func openerDeep(gameMode: String, limit: Int = 5, playType: String = "solo") async -> [OpenerDeepStat] {
        if playType == "vs_cpu" { return [] }
        let rows = await myGuessRows(gameMode: gameMode, playType: playType)
        var map: [String: (count: Int, greens: Int, yellows: Int, wins: Int)] = [:]
        for r in rows {
            guard let first = r.guesses.first, let sol = r.solutions.first,
                  let states = safeEval(solution: sol, guess: first) else { continue }
            let opener = first.uppercased()
            var e = map[opener] ?? (0, 0, 0, 0)
            e.count += 1
            e.greens += states.filter { $0 == .correct }.count
            e.yellows += states.filter { $0 == .present }.count
            if r.won { e.wins += 1 }
            map[opener] = e
        }
        return map.map { word, s in
            OpenerDeepStat(word: word, count: s.count,
                           avgGreens: (Double(s.greens) / Double(s.count) * 10).rounded() / 10,
                           avgYellows: (Double(s.yellows) / Double(s.count) * 10).rounded() / 10,
                           winRate: Int((Double(s.wins) / Double(s.count) * 100).rounded()))
        }
        .sorted { $0.count > $1.count }
        .prefix(limit).map { $0 }
    }

    // MARK: - Position accuracy (web fetchPositionAccuracy)

    struct PositionAccuracy {
        let wordLength: Int
        /// Per position: share of ALL guesses that had that slot correct (0–100).
        let pct: [Int]
        let sampleGuesses: Int
    }

    /// How often each letter slot comes up green across all guesses.
    static func positionAccuracy(gameMode: String, playType: String = "solo") async -> PositionAccuracy? {
        if playType == "vs_cpu" { return nil }
        let rows = await myGuessRows(gameMode: gameMode, playType: playType)
        guard let firstSolution = rows.first?.solutions.first else { return nil }
        let wordLength = firstSolution.count
        var correct = [Int](repeating: 0, count: wordLength)
        var total = 0
        for r in rows {
            guard let sol = r.solutions.first else { continue }
            for g in r.guesses {
                guard let states = safeEval(solution: sol, guess: g), states.count == wordLength else { continue }
                total += 1
                for (i, s) in states.enumerated() where s == .correct { correct[i] += 1 }
            }
        }
        guard total >= 10 else { return nil }
        return PositionAccuracy(wordLength: wordLength,
                                pct: correct.map { Int((Double($0) / Double(total) * 100).rounded()) },
                                sampleGuesses: total)
    }

    // MARK: - Word Almanac (web fetchWordAlmanac)

    struct AlmanacEntry: Identifiable {
        let word: String
        let won: Bool
        let guesses: Int
        let time: Int
        let date: String
        var id: String { "\(word)-\(date)" }
    }

    /// Recent solutions faced (first board), with result + pace.
    static func wordAlmanac(gameMode: String, limit: Int = 24, playType: String = "solo") async -> [AlmanacEntry] {
        if playType == "vs_cpu" { return [] }
        let rows = await myGuessRows(gameMode: gameMode, limit: limit, playType: playType)
        return rows.compactMap { r in
            guard let sol = r.solutions.first else { return nil }
            return AlmanacEntry(word: sol.uppercased(), won: r.won,
                                guesses: r.guesses.count, time: r.time, date: r.createdAt)
        }
    }

    // MARK: - Gauntlet stage breakdown (web fetchGauntletStageStats)

    struct GauntletStageStat: Identifiable {
        let stage: Int          // 0-based
        let name: String?
        let runs: Int
        let clears: Int
        let avgTimeSecs: Int
        var id: Int { stage }
    }

    /// Gauntlet stage analytics from stored gauntlet_stages.stageResults.
    static func gauntletStageStats(playType: String = "solo") async -> [GauntletStageStat] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        struct StageResult: Decodable {
            let name: String?
            let status: String?
            let timeMs: Double?
        }
        struct Stages: Decodable { let stageResults: [StageResult]? }
        struct Row: Decodable { let gauntlet_stages: Stages? }
        var q = client.from("matches")
            .select("gauntlet_stages")
            .eq("player1_id", value: uid)
            .eq("game_mode", value: "GAUNTLET")
            .not("gauntlet_stages", operator: .is, value: "null")
        q = MatchStatsService.scopeToPlayType(q, playType)
        let rows: [Row] = (try? await q
            .order("created_at", ascending: false)
            .limit(200).execute().value) ?? []

        var agg: [(name: String?, runs: Int, clears: Int, timeMs: Double, timed: Int)] = []
        for row in rows {
            guard let results = row.gauntlet_stages?.stageResults else { continue }
            for (i, sr) in results.enumerated() {
                while agg.count <= i { agg.append((nil, 0, 0, 0, 0)) }
                agg[i].runs += 1
                if sr.status?.uppercased() == "WON" { agg[i].clears += 1 }
                if let t = sr.timeMs, t > 0 { agg[i].timeMs += t; agg[i].timed += 1 }
                if agg[i].name == nil, let n = sr.name { agg[i].name = n }
            }
        }
        return agg.enumerated().compactMap { i, a in
            guard a.runs > 0 else { return nil }
            return GauntletStageStat(stage: i, name: a.name, runs: a.runs, clears: a.clears,
                                     avgTimeSecs: a.timed > 0 ? Int((a.timeMs / Double(a.timed) / 1000).rounded()) : 0)
        }
    }

    // MARK: - Hint honesty (web fetchHintHonesty)

    struct HintHonesty {
        let hintlessWinRate: Int   // % of wins that used zero hints
        let avgHintsPerGame: Double
        let gamesCounted: Int
    }

    /// Hint usage honesty card (Six/Seven/ProperNoundle — hints_used is stored).
    static func hintHonesty(gameMode: String, playType: String = "solo") async -> HintHonesty? {
        if playType == "vs_cpu" { return nil }
        let rows = await myGuessRows(gameMode: gameMode, playType: playType)
        guard !rows.isEmpty else { return nil }
        let wins = rows.filter(\.won)
        guard !wins.isEmpty else { return nil }
        let hintlessWins = wins.filter { $0.hintsUsed == 0 }.count
        let totalHints = rows.reduce(0) { $0 + $1.hintsUsed }
        return HintHonesty(
            hintlessWinRate: Int((Double(hintlessWins) / Double(wins.count) * 100).rounded()),
            avgHintsPerGame: (Double(totalHints) / Double(rows.count) * 10).rounded() / 10,
            gamesCounted: rows.count)
    }

    // MARK: - Skill radar (web fetchSkillRadar)

    struct SkillRadarData {
        /// All axes 0–100.
        let speed: Int
        let accuracy: Int
        let consistency: Int
        let endurance: Int
        let versatility: Int
    }

    /// Five 0–100 axes from user_stats + recent solve times.
    static func skillRadar() async -> SkillRadarData? {
        guard let uid = await userId() else { return nil }
        async let statsAsync = UserStatsService.fetch(userId: uid)
        async let timesAsync = MatchStatsService.solveTimes(limit: 20)
        let rows = await statsAsync.filter { $0.playType == "solo" }
        let times = await timesAsync
        guard !rows.isEmpty else { return nil }
        let totalGames = rows.reduce(0) { $0 + $1.totalGames }
        guard totalGames >= 5 else { return nil }

        // Accuracy: overall win rate.
        let wins = rows.reduce(0) { $0 + $1.wins }
        let accuracy = Int((Double(wins) / Double(max(1, totalGames)) * 100).rounded())

        // Speed: recent solve times vs a 5-minute yardstick (faster → higher).
        let avgTime = times.isEmpty ? 300.0 : Double(times.reduce(0) { $0 + $1.seconds }) / Double(times.count)
        let speed = Int(min(100, max(0, 100 - avgTime / 300 * 100)).rounded())

        // Consistency: coefficient of variation of recent times (steadier → higher).
        var consistency = 50
        if times.count >= 5 {
            let variance = times.reduce(0.0) { $0 + pow(Double($1.seconds) - avgTime, 2) } / Double(times.count)
            let cv = sqrt(variance) / max(1, avgTime)
            consistency = Int(min(100, max(0, 100 - cv * 100)).rounded())
        }

        // Endurance: Gauntlet clear rate (the marathon mode).
        let g = rows.first { $0.gameMode == "GAUNTLET" }
        let endurance = (g != nil && g!.totalGames > 0)
            ? Int((Double(g!.wins) / Double(g!.totalGames) * 100).rounded()) : 0

        // Versatility: how evenly play spreads across modes (normalized entropy).
        let played = rows.filter { $0.totalGames > 0 }
        var versatility = 0
        if played.count > 1 {
            let H = played.reduce(0.0) { acc, r in
                let p = Double(r.totalGames) / Double(totalGames)
                return acc - p * log(p)
            }
            versatility = Int((H / log(9.0) * 100).rounded())
        }
        return SkillRadarData(speed: speed, accuracy: accuracy, consistency: consistency,
                              endurance: endurance, versatility: versatility)
    }

    // MARK: - Rivalries (web fetchRivalries)

    struct Rivalry: Identifiable {
        let opponentId: String
        let username: String
        let wins: Int
        let losses: Int
        let draws: Int
        let total: Int
        var id: String { opponentId }
    }

    /// Most-faced human opponents with the head-to-head record.
    static func rivalries(limit: Int = 5) async -> [Rivalry] {
        guard let uid = await userId() else { return [] }
        struct Row: Decodable { let player1_id: String; let player2_id: String?; let winner_id: String? }
        let rows: [Row] = (try? await client.from("matches")
            .select("player1_id, player2_id, winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .not("player2_id", operator: .is, value: "null")
            .order("created_at", ascending: false)
            .limit(1000).execute().value) ?? []
        var map: [String: (wins: Int, losses: Int, draws: Int)] = [:]
        for m in rows {
            let opp = m.player1_id == uid ? (m.player2_id ?? "") : m.player1_id
            guard !opp.isEmpty, opp != uid else { continue }
            var e = map[opp] ?? (0, 0, 0)
            if m.winner_id == uid { e.wins += 1 }
            else if m.winner_id != nil { e.losses += 1 }
            else { e.draws += 1 }
            map[opp] = e
        }
        let top = map.map { (id: $0.key, r: $0.value, total: $0.value.wins + $0.value.losses + $0.value.draws) }
            .sorted { $0.total > $1.total }
            .prefix(limit)
        guard !top.isEmpty else { return [] }
        let names = await PublicProfileService.usernames(ids: top.map(\.id))
        return top.map { Rivalry(opponentId: $0.id, username: names[$0.id] ?? "Unknown",
                                 wins: $0.r.wins, losses: $0.r.losses, draws: $0.r.draws, total: $0.total) }
    }
}
