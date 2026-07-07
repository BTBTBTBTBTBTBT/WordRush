import Foundation
import Supabase
import WordociousCore

/// Queries the `matches` table to power the Profile dashboard charts — ports the
/// relevant fetchers in apps/web/lib/stats-service.ts. Native records solo games
/// as `matches` rows (player1_id = user, player2_id = null) via
/// GameResultsService.recordSoloMatch, so every chart filters on player1_id.
enum MatchStatsService {

    // -- Play-type scoping (restat B1, ports stats-service.ts StatsPlayType) --
    // `matches` has NO play_type column: solo = no opponent (player2_id null),
    // vs = has opponent, and vs_cpu games are NEVER recorded as match rows
    // (practice writes user_stats aggregates only). Per-game stat fetchers take
    // a playType ("solo" | "vs" | "vs_cpu") so the profile toggle scopes charts
    // honestly; the vs_cpu branch returns empty and callers show a 'totals
    // only' note instead.
    static func scopeToPlayType(_ q: PostgrestFilterBuilder, _ playType: String) -> PostgrestFilterBuilder {
        playType == "vs"
            ? q.not("player2_id", operator: .is, value: "null")
            : q.is("player2_id", value: nil)
    }

    // MARK: Result models
    struct GuessBucket: Identifiable { let guesses: Int; let count: Int; var label: String = ""; var id: Int { guesses } }
    struct DayActivity: Identifiable { let day: Date; let played: Int; let won: Int; var id: Date { day } }
    struct SolvePoint: Identifiable { let index: Int; let date: Date; let seconds: Int; let mode: String; var id: Int { index } }
    struct HourBucket: Identifiable { let hour: Int; let played: Int; let won: Int; var id: Int { hour } }
    struct TopWord: Identifiable { let word: String; let count: Int; let wins: Int; var id: String { word } }
    struct ProInsights {
        var fastestTime: Int?; var fastestDate: String?
        var fewestGuesses: Int?; var fewestDate: String?
        var perfectGames = 0
        var consistency = 0; var consistencySample = 0
        var recentAvg = 0; var overallAvg = 0; var improving = false; var percentChange = 0
        // Word + streak + VS insights (ports fetchWordInsights / fetchModeWinStreak /
        // fetchHeadToHeadRecord + peakHourLabel from stats-service.ts).
        var currentStreak = 0; var bestStreak = 0
        var avgGuesses = 0.0; var firstTryRate = 0
        var luckyWord: String?; var luckyTime = 0
        var nemesisWord: String?; var nemesisLosses = 0
        var peakHour: Int?
        var vsWins = 0; var vsLosses = 0; var vsTotal = 0; var vsWinRate = 0
        var hasData: Bool {
            fastestTime != nil || fewestGuesses != nil || perfectGames > 0
                || avgGuesses > 0 || currentStreak > 0 || vsTotal > 0
        }
    }

    // MARK: Row decoders
    private struct ScoreRow: Decodable { let player1_score: Int?; let game_mode: String; let winner_id: String? }
    private struct DateWinRow: Decodable { let created_at: String; let winner_id: String?; let game_mode: String }
    private struct TimeRow: Decodable { let player1_time: Double?; let game_mode: String; let created_at: String }
    private struct GuessesRow: Decodable { let player1_guesses: [String]?; let winner_id: String? }
    private struct InsightRow: Decodable { let player1_time: Double?; let player1_score: Int?; let created_at: String }

    private static func userId() async -> String? {
        // Postgres returns uuids lowercase; session.user.id.uuidString is uppercase.
        // Lowercase it so client-side winner_id/player1_id string compares match
        // (server-side .eq on the uuid column is case-insensitive either way).
        (try? await AuthService.shared.client.auth.session.user.id.uuidString)?.lowercased()
    }

    /// Wins bucketed by guess count (1–6) — guess-distribution bar chart.
    static func guessDistribution(mode: GameMode? = nil, playType: String = "solo") async -> [GuessBucket] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_score,game_mode,winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("winner_id", value: uid)
        q = scopeToPlayType(q, playType)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [ScoreRow] = (try? await q.execute().value) ?? []
        // Bucket range follows the mode's real max guesses — a 7/13 OctoWord win
        // must not clamp into "6". GAUNTLET and the All view clamp into "N+".
        let distMax: [String: Int] = [
            "DUEL": 6, "RESCUE": 6, "PROPERNOUNDLE": 6, "DUEL_6": 7, "DUEL_7": 8,
            "QUORDLE": 9, "SEQUENCE": 10, "OCTORDLE": 13, "GAUNTLET": 13,
        ]
        let maxBucket = mode.map { distMax[$0.rawValue] ?? 6 } ?? 6
        let clampable = mode == nil || mode == .gauntlet
        var counts = [Int: Int]()
        for r in rows {
            guard let s = r.player1_score, s > 0 else { continue }
            counts[min(s, maxBucket), default: 0] += 1
        }
        return (1...maxBucket).map {
            GuessBucket(guesses: $0, count: counts[$0] ?? 0,
                        label: "\($0)" + (clampable && $0 == maxBucket ? "+" : ""))
        }
    }

    /// Per-day games played + won over the last `days` (activity calendar).
    static func activityCalendar(days: Int = 90, mode: GameMode? = nil) async -> [DayActivity] {
        guard let uid = await userId() else { return [] }
        let since = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        var q = AuthService.shared.client.from("matches")
            .select("created_at,winner_id,game_mode")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .gte("created_at", value: ISO8601DateFormatter().string(from: since))
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [DateWinRow] = (try? await q.limit(2000).execute().value) ?? []
        var byDay = [Date: (played: Int, won: Int)]()
        // UTC buckets — web stats-service + Android bucket created_at by UTC
        // date; local buckets put the same game on different squares per platform.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        for r in rows {
            guard let d = parseTimestamp(r.created_at) else { continue }
            let day = cal.startOfDay(for: d)
            var e = byDay[day] ?? (0, 0)
            e.played += 1
            if r.winner_id == uid { e.won += 1 }
            byDay[day] = e
        }
        return byDay.map { DayActivity(day: $0.key, played: $0.value.played, won: $0.value.won) }
            .sorted { $0.day < $1.day }
    }

    /// Recent solo wins' solve times, oldest→newest (solve-time line chart).
    static func solveTimes(mode: GameMode? = nil, limit: Int = 30, playType: String = "solo") async -> [SolvePoint] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_time,game_mode,created_at")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("winner_id", value: uid)
            .gt("player1_time", value: 0)
        q = scopeToPlayType(q, playType)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [TimeRow] = (try? await q.order("created_at", ascending: false).limit(limit).execute().value) ?? []
        // Reverse to chronological order, then index for the X axis.
        return rows.reversed().enumerated().compactMap { i, r in
            guard let t = r.player1_time, let d = parseTimestamp(r.created_at) else { return nil }
            return SolvePoint(index: i, date: d, seconds: Int(t.rounded()), mode: r.game_mode)
        }
    }

    /// Games played + won per local hour (0–23) — time-of-day heatmap.
    static func timeOfDay(mode: GameMode? = nil, playType: String = "solo") async -> [HourBucket] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("created_at,winner_id,game_mode")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
        q = scopeToPlayType(q, playType)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [DateWinRow] = (try? await q.limit(2000).execute().value) ?? []
        var played = [Int: Int](), won = [Int: Int]()
        let cal = Calendar.current
        for r in rows {
            guard let d = parseTimestamp(r.created_at) else { continue }
            let h = cal.component(.hour, from: d)
            played[h, default: 0] += 1
            if r.winner_id == uid { won[h, default: 0] += 1 }
        }
        return (0..<24).map { HourBucket(hour: $0, played: played[$0] ?? 0, won: won[$0] ?? 0) }
    }

    struct SolvedDaily { let guesses: [String]; let solutions: [String]; let won: Bool; let guessCount: Int; let timeSeconds: Int; let hintsUsed: Int }

    /// Server-persisted Gauntlet per-stage breakdown (matches.gauntlet_stages),
    /// so the results screen renders cross-device when there's no local session.
    struct GauntletStagesData: Decodable {
        let stages: [GauntletStageConfig]
        let stageResults: [GauntletStageResult]
    }
    static func gauntletStages(seed: String) async -> GauntletStagesData? {
        guard let uid = await userId() else { return nil }
        struct Row: Decodable { let gauntlet_stages: GauntletStagesData? }
        let rows: [Row]? = try? await AuthService.shared.client.from("matches")
            .select("gauntlet_stages")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: "GAUNTLET")
            .eq("seed", value: seed)
            .order("created_at", ascending: false)
            .limit(1).execute().value
        return rows?.first?.gauntlet_stages ?? nil
    }

    /// Reconstruct a completed daily from its `matches` row (player1_guesses +
    /// solutions) so "View Solved Puzzle" works cross-device — both web and
    /// native solo plays write this row, keyed by the deterministic daily seed.
    static func solvedDaily(mode: GameMode, seed: String) async -> SolvedDaily? {
        guard let uid = await userId() else { return nil }
        struct Row: Decodable {
            let player1_guesses: [String]?; let solutions: [String]?
            let winner_id: String?; let player1_score: Int?; let player1_time: Double?
            let hints_used: Int?
        }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("player1_guesses,solutions,winner_id,player1_score,player1_time,hints_used")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: mode.rawValue)
            .eq("seed", value: seed)
            .order("created_at", ascending: false)
            .limit(1).execute().value) ?? []
        guard let row = rows.first, let g = row.player1_guesses, let s = row.solutions, !g.isEmpty, !s.isEmpty else { return nil }
        return SolvedDaily(guesses: g, solutions: s, won: row.winner_id == uid,
                           guessCount: row.player1_score ?? g.count, timeSeconds: Int((row.player1_time ?? 0).rounded()),
                           hintsUsed: row.hints_used ?? 0)
    }

    /// A recorded guess entry is a real typed word only if it's all letters.
    /// Hint rows live in the guess log as space-padded strings ("  A  ") and
    /// must not surface in word stats (they rendered as blank rows).
    static func isRealGuessWord(_ w: String) -> Bool {
        !w.isEmpty && w.allSatisfy { $0.isLetter }
    }

    /// Top-5 most-guessed words (+ win counts) — ports fetchTopWordsAllTime.
    static func topWords(mode: GameMode? = nil, limit: Int = 5, playType: String = "solo") async -> [TopWord] {
        if playType == "vs_cpu" { return [] }
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_guesses,winner_id,game_mode")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
        q = scopeToPlayType(q, playType)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [GuessesRow] = (try? await q.order("created_at", ascending: false).limit(1000).execute().value) ?? []
        var counts = [String: (count: Int, wins: Int)]()
        for r in rows {
            guard let guesses = r.player1_guesses else { continue }
            let won = r.winner_id == uid
            for w in guesses {
                let key = w.uppercased()
                guard isRealGuessWord(key) else { continue }
                var e = counts[key] ?? (0, 0)
                e.count += 1; if won { e.wins += 1 }
                counts[key] = e
            }
        }
        return counts.map { TopWord(word: $0.key, count: $0.value.count, wins: $0.value.wins) }
            .sorted { $0.count > $1.count }
            .prefix(limit).map { $0 }
    }

    /// Pro per-mode insights (personal bests, perfect games, consistency,
    /// improvement trend) — ports the fetch* helpers in stats-service.ts.
    static func proInsights(mode: GameMode, playType: String = "solo") async -> ProInsights {
        if playType == "vs_cpu" { return ProInsights() }
        guard let uid = await userId() else { return ProInsights() }
        var q = AuthService.shared.client.from("matches")
            .select("player1_time,player1_score,created_at")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("winner_id", value: uid)
            .eq("game_mode", value: mode.rawValue)
            .gt("player1_time", value: 0)
        q = scopeToPlayType(q, playType)
        let rows: [InsightRow] = (try? await q
            .order("created_at", ascending: false)
            .limit(200).execute().value) ?? []

        var out = ProInsights()
        guard !rows.isEmpty else { return out }

        if let fast = rows.min(by: { ($0.player1_time ?? .infinity) < ($1.player1_time ?? .infinity) }),
           let t = fast.player1_time {
            out.fastestTime = Int(t.rounded()); out.fastestDate = String(fast.created_at.prefix(10))
        }
        let scored = rows.filter { ($0.player1_score ?? 0) > 0 }
        if let few = scored.min(by: { ($0.player1_score ?? .max) < ($1.player1_score ?? .max) }) {
            out.fewestGuesses = few.player1_score; out.fewestDate = String(few.created_at.prefix(10))
        }
        out.perfectGames = rows.filter { $0.player1_score == 1 }.count

        let times = rows.compactMap { $0.player1_time }
        let last20 = Array(times.prefix(20))
        if last20.count >= 3 {
            let avg = last20.reduce(0, +) / Double(last20.count)
            let variance = last20.reduce(0) { $0 + ($1 - avg) * ($1 - avg) } / Double(last20.count)
            let cv = avg > 0 ? sqrt(variance) / avg : 0
            out.consistency = max(0, Int((100 - cv * 100).rounded()))
            out.consistencySample = last20.count
        }

        let last10 = Array(times.prefix(10))
        if !last10.isEmpty {
            out.recentAvg = Int((last10.reduce(0, +) / Double(last10.count)).rounded())
            out.overallAvg = Int((times.reduce(0, +) / Double(times.count)).rounded())
            out.improving = out.recentAvg < out.overallAvg
            out.percentChange = out.overallAvg > 0 ? Int((Double(out.overallAvg - out.recentAvg) / Double(out.overallAvg) * 100).rounded()) : 0
        }

        // Word insights (nemesis / lucky / avg guesses / first-try rate), win
        // streak, peak hour, and VS head-to-head — fetched alongside in parallel.
        async let words = wordInsights(uid: uid, mode: mode, playType: playType)
        async let streak = modeWinStreak(uid: uid, mode: mode, playType: playType)
        async let peak = peakHour(uid: uid, mode: mode, playType: playType)
        async let h2h = headToHead(uid: uid, mode: mode)
        let w = await words, st = await streak, ph = await peak, vs = await h2h
        out.avgGuesses = w.avgGuesses; out.firstTryRate = w.firstTryRate
        out.luckyWord = w.luckyWord; out.luckyTime = w.luckyTime
        out.nemesisWord = w.nemesisWord; out.nemesisLosses = w.nemesisLosses
        out.currentStreak = st.current; out.bestStreak = st.best
        out.peakHour = ph
        out.vsWins = vs.wins; out.vsLosses = vs.losses; out.vsTotal = vs.total; out.vsWinRate = vs.winRate
        return out
    }

    // MARK: Insight sub-fetchers (ports stats-service.ts helpers)

    /// Nemesis (most-lost solution), lucky word (fastest solve), avg guesses,
    /// first-try rate — ports fetchWordInsights.
    private static func wordInsights(uid: String, mode: GameMode, playType: String = "solo")
        async -> (nemesisWord: String?, nemesisLosses: Int, luckyWord: String?, luckyTime: Int, avgGuesses: Double, firstTryRate: Int) {
        struct Row: Decodable { let solutions: [String]?; let winner_id: String?; let player1_time: Double?; let player1_score: Int? }
        if playType == "vs_cpu" { return (nil, 0, nil, 0, 0, 0) }
        var q = AuthService.shared.client.from("matches")
            .select("solutions,winner_id,player1_time,player1_score")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: mode.rawValue)
            .not("solutions", operator: .is, value: "null")
        q = scopeToPlayType(q, playType)
        let rows: [Row] = (try? await q
            .order("created_at", ascending: false)
            .limit(500).execute().value) ?? []
        var lossMap = [String: Int]()
        var speedMap = [String: Double]()   // word -> best (lowest) time
        var totalGuesses = 0, totalWins = 0, firstTryWins = 0
        for r in rows {
            guard let sols = r.solutions else { continue }
            if r.winner_id == uid {
                totalWins += 1
                if r.player1_score == 1 { firstTryWins += 1 }
                totalGuesses += r.player1_score ?? 0
                let t = r.player1_time ?? 0
                for word in sols {
                    let w = word.uppercased()
                    if let cur = speedMap[w] { if t > 0 && t < cur { speedMap[w] = t } }
                    else { speedMap[w] = t }
                }
            } else {
                for word in sols { lossMap[word.uppercased(), default: 0] += 1 }
            }
        }
        var nemesisWord: String?; var nemesisLosses = 0
        for (word, losses) in lossMap where losses > nemesisLosses { nemesisLosses = losses; nemesisWord = word }
        var luckyWord: String?; var bestTime = Double.infinity
        for (word, t) in speedMap where t > 0 && t < bestTime { bestTime = t; luckyWord = word }
        let avg = totalWins > 0 ? (Double(totalGuesses) / Double(totalWins) * 10).rounded() / 10 : 0
        let ftr = totalWins > 0 ? Int((Double(firstTryWins) / Double(totalWins) * 100).rounded()) : 0
        return (nemesisWord, nemesisLosses, luckyWord, luckyWord != nil ? Int(bestTime.rounded()) : 0, avg, ftr)
    }

    /// Current + best win streak over the most-recent 200 games — ports fetchModeWinStreak.
    /// Fewest-guesses, then fastest winning solo run for (uid, mode) — powers the
    /// "Beat Your Best" ghost race. nil if the player has no win in that mode.
    static func ghostBestRun(uid: String, mode: GameMode) async -> (guesses: Int, timeMs: Double)? {
        struct Row: Decodable { let player1_score: Int; let player1_time: Int }
        let rows: [Row]? = try? await AuthService.shared.client.from("matches")
            .select("player1_score, player1_time")
            .eq("player1_id", value: uid)
            .eq("game_mode", value: mode.rawValue)
            .eq("winner_id", value: uid)
            .gt("player1_time", value: 0)
            .gt("player1_score", value: 0)
            .order("player1_score", ascending: true)
            .order("player1_time", ascending: true)
            .limit(1).execute().value
        guard let r = rows?.first else { return nil }
        return (r.player1_score, Double(r.player1_time) * 1000)
    }

    static func modeWinStreak(uid: String, mode: GameMode, playType: String = "solo") async -> (current: Int, best: Int) {
        struct Row: Decodable { let winner_id: String? }
        if playType == "vs_cpu" { return (0, 0) }
        var q = AuthService.shared.client.from("matches")
            .select("winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: mode.rawValue)
        q = scopeToPlayType(q, playType)
        let rows: [Row] = (try? await q
            .order("created_at", ascending: false)
            .limit(200).execute().value) ?? []
        var current = 0, best = 0, streak = 0, foundFirstLoss = false
        for r in rows {
            if r.winner_id == uid {
                streak += 1; best = max(best, streak)
                if !foundFirstLoss { current = streak }
            } else { foundFirstLoss = true; streak = 0 }
        }
        return (current, best)
    }

    /// Hour (0–23) with the best win-rate among hours with ≥3 games — ports peakHourLabel.
    private static func peakHour(uid: String, mode: GameMode, playType: String = "solo") async -> Int? {
        let buckets = await timeOfDay(mode: mode, playType: playType)
        var bestHour: Int?, bestRate = -1.0, bestCount = 0
        for b in buckets where b.played >= 3 {
            let rate = Double(b.won) / Double(b.played)
            if rate > bestRate || (rate == bestRate && b.played > bestCount) {
                bestRate = rate; bestHour = b.hour; bestCount = b.played
            }
        }
        return bestHour
    }

    /// VS head-to-head record (player2 not null) — ports fetchHeadToHeadRecord.
    private static func headToHead(uid: String, mode: GameMode) async -> (wins: Int, losses: Int, total: Int, winRate: Int) {
        struct Row: Decodable { let winner_id: String? }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: mode.rawValue)
            .not("player2_id", operator: .is, value: "null")
            .limit(1000).execute().value) ?? []
        var wins = 0, losses = 0
        for r in rows {
            if r.winner_id == uid { wins += 1 }
            else if r.winner_id != nil { losses += 1 }
        }
        let total = wins + losses
        return (wins, losses, total, total > 0 ? Int((Double(wins) / Double(total) * 100).rounded()) : 0)
    }

    // MARK: Daily Sweep / Flawless Victory stats (profile "All" view)
    // Source of truth: daily_bonuses (sweep/flawless flags per day) ⨝ daily_results
    // (per-mode time + composite_score per day). Mirrors stats-service.ts.

    struct DailySweepStats {
        var sweepCount = 0
        var flawlessCount = 0
        var avgSweepSecs = 0
        var avgFlawlessSecs = 0
        var bestSweepSecs = 0
        var bestFlawlessSecs = 0
        var currentSweepStreak = 0
        var hasData: Bool { sweepCount > 0 || flawlessCount > 0 }
    }

    struct DailyPointsPoint: Identifiable {
        let day: String
        let totalPoints: Int
        let swept: Bool
        let flawless: Bool
        var id: String { day }
    }

    /// Add/subtract days from a YYYY-MM-DD local-day string.
    private static func dayShift(_ day: String, _ delta: Int) -> String {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return day }
        var comps = DateComponents(); comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]
        let cal = Calendar.current
        guard let base = cal.date(from: comps),
              let shifted = cal.date(byAdding: .day, value: delta, to: base) else { return day }
        let f = DateFormatter(); f.calendar = cal; f.dateFormat = "yyyy-MM-dd"
        return f.string(from: shifted)
    }

    static func dailySweepStats() async -> DailySweepStats {
        guard let uid = await userId() else { return DailySweepStats() }
        struct BonusRow: Decodable { let day: String; let sweep_awarded: Bool?; let flawless_awarded: Bool? }
        struct TimeRow: Decodable { let day: String; let time_seconds: Double? }

        let bonuses: [BonusRow] = (try? await AuthService.shared.client.from("daily_bonuses")
            .select("day, sweep_awarded, flawless_awarded")
            .eq("user_id", value: uid)
            .execute().value) ?? []
        guard !bonuses.isEmpty else { return DailySweepStats() }

        let sweepDays = bonuses.filter { $0.sweep_awarded == true }.map { $0.day }
        let flawlessDays = Set(bonuses.filter { $0.flawless_awarded == true }.map { $0.day })
        guard !sweepDays.isEmpty else { return DailySweepStats() }

        let rows: [TimeRow] = (try? await AuthService.shared.client.from("daily_results")
            .select("day, time_seconds")
            .eq("user_id", value: uid)
            .eq("play_type", value: "solo")
            .in("day", values: sweepDays)
            .execute().value) ?? []
        var perDayTime: [String: Double] = [:]
        for r in rows { perDayTime[r.day, default: 0] += (r.time_seconds ?? 0) }

        let sweepTimes = sweepDays.compactMap { perDayTime[$0] }.filter { $0 > 0 }
        let flawlessTimes = flawlessDays.compactMap { perDayTime[$0] }.filter { $0 > 0 }
        func avg(_ xs: [Double]) -> Int { xs.isEmpty ? 0 : Int((xs.reduce(0,+) / Double(xs.count)).rounded()) }
        func best(_ xs: [Double]) -> Int { xs.isEmpty ? 0 : Int(xs.min()!) }

        let sweepSet = Set(sweepDays)
        let today = LeaderboardService.todayLocal()
        var cursor: String? = sweepSet.contains(today) ? today
            : (sweepSet.contains(dayShift(today, -1)) ? dayShift(today, -1) : nil)
        var streak = 0
        while let c = cursor, sweepSet.contains(c) { streak += 1; cursor = dayShift(c, -1) }

        return DailySweepStats(
            sweepCount: sweepDays.count, flawlessCount: flawlessDays.count,
            avgSweepSecs: avg(sweepTimes), avgFlawlessSecs: avg(flawlessTimes),
            bestSweepSecs: best(sweepTimes), bestFlawlessSecs: best(flawlessTimes),
            currentSweepStreak: streak)
    }

    static func dailyPointsOverTime(days: Int = 30) async -> [DailyPointsPoint] {
        guard let uid = await userId() else { return [] }
        struct ScoreRow: Decodable { let day: String; let composite_score: Double? }
        struct BonusRow: Decodable { let day: String; let sweep_awarded: Bool?; let flawless_awarded: Bool? }
        let cutoff = dayShift(LeaderboardService.todayLocal(), -(days - 1))

        let rows: [ScoreRow] = (try? await AuthService.shared.client.from("daily_results")
            .select("day, composite_score")
            .eq("user_id", value: uid)
            .eq("play_type", value: "solo")
            .gte("day", value: cutoff)
            .execute().value) ?? []
        guard !rows.isEmpty else { return [] }

        let bonuses: [BonusRow] = (try? await AuthService.shared.client.from("daily_bonuses")
            .select("day, sweep_awarded, flawless_awarded")
            .eq("user_id", value: uid)
            .gte("day", value: cutoff)
            .execute().value) ?? []
        let sweptSet = Set(bonuses.filter { $0.sweep_awarded == true }.map { $0.day })
        let flawlessSet = Set(bonuses.filter { $0.flawless_awarded == true }.map { $0.day })

        var perDay: [String: Int] = [:]
        for r in rows { perDay[r.day, default: 0] += Int((r.composite_score ?? 0).rounded()) }
        return perDay.map { DailyPointsPoint(day: $0.key, totalPoints: $0.value,
            swept: sweptSet.contains($0.key), flawless: flawlessSet.contains($0.key)) }
            .sorted { $0.day < $1.day }
    }
}
