import Foundation
import Supabase
import WordociousCore

/// Queries the `matches` table to power the Profile dashboard charts — ports the
/// relevant fetchers in apps/web/lib/stats-service.ts. Native records solo games
/// as `matches` rows (player1_id = user, player2_id = null) via
/// GameResultsService.recordSoloMatch, so every chart filters on player1_id.
enum MatchStatsService {

    // MARK: Result models
    struct GuessBucket: Identifiable { let guesses: Int; let count: Int; var id: Int { guesses } }
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
    static func guessDistribution(mode: GameMode? = nil) async -> [GuessBucket] {
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_score,game_mode,winner_id")
            .eq("player1_id", value: uid)
            .eq("winner_id", value: uid)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [ScoreRow] = (try? await q.execute().value) ?? []
        var counts = [Int: Int]()
        for r in rows {
            guard let s = r.player1_score, s > 0 else { continue }
            counts[min(s, 6), default: 0] += 1
        }
        return (1...6).map { GuessBucket(guesses: $0, count: counts[$0] ?? 0) }
    }

    /// Per-day games played + won over the last `days` (activity calendar).
    static func activityCalendar(days: Int = 90, mode: GameMode? = nil) async -> [DayActivity] {
        guard let uid = await userId() else { return [] }
        let since = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        var q = AuthService.shared.client.from("matches")
            .select("created_at,winner_id,game_mode")
            .eq("player1_id", value: uid)
            .gte("created_at", value: ISO8601DateFormatter().string(from: since))
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [DateWinRow] = (try? await q.limit(2000).execute().value) ?? []
        var byDay = [Date: (played: Int, won: Int)]()
        let cal = Calendar.current
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
    static func solveTimes(mode: GameMode? = nil, limit: Int = 30) async -> [SolvePoint] {
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_time,game_mode,created_at")
            .eq("player1_id", value: uid)
            .eq("winner_id", value: uid)
            .gt("player1_time", value: 0)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [TimeRow] = (try? await q.order("created_at", ascending: false).limit(limit).execute().value) ?? []
        // Reverse to chronological order, then index for the X axis.
        return rows.reversed().enumerated().compactMap { i, r in
            guard let t = r.player1_time, let d = parseTimestamp(r.created_at) else { return nil }
            return SolvePoint(index: i, date: d, seconds: Int(t.rounded()), mode: r.game_mode)
        }
    }

    /// Games played + won per local hour (0–23) — time-of-day heatmap.
    static func timeOfDay(mode: GameMode? = nil) async -> [HourBucket] {
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("created_at,winner_id,game_mode")
            .eq("player1_id", value: uid)
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

    struct SolvedDaily { let guesses: [String]; let solutions: [String]; let won: Bool; let guessCount: Int; let timeSeconds: Int }

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
            .eq("player1_id", value: uid)
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
        }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("player1_guesses,solutions,winner_id,player1_score,player1_time")
            .eq("player1_id", value: uid)
            .eq("game_mode", value: mode.rawValue)
            .eq("seed", value: seed)
            .order("created_at", ascending: false)
            .limit(1).execute().value) ?? []
        guard let row = rows.first, let g = row.player1_guesses, let s = row.solutions, !g.isEmpty, !s.isEmpty else { return nil }
        return SolvedDaily(guesses: g, solutions: s, won: row.winner_id == uid,
                           guessCount: row.player1_score ?? g.count, timeSeconds: Int((row.player1_time ?? 0).rounded()))
    }

    /// Top-5 most-guessed words (+ win counts) — ports fetchTopWordsAllTime.
    static func topWords(mode: GameMode? = nil, limit: Int = 5) async -> [TopWord] {
        guard let uid = await userId() else { return [] }
        var q = AuthService.shared.client.from("matches")
            .select("player1_guesses,winner_id,game_mode")
            .eq("player1_id", value: uid)
        if let mode { q = q.eq("game_mode", value: mode.rawValue) }
        let rows: [GuessesRow] = (try? await q.order("created_at", ascending: false).limit(1000).execute().value) ?? []
        var counts = [String: (count: Int, wins: Int)]()
        for r in rows {
            guard let guesses = r.player1_guesses else { continue }
            let won = r.winner_id == uid
            for w in guesses {
                let key = w.uppercased()
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
    static func proInsights(mode: GameMode) async -> ProInsights {
        guard let uid = await userId() else { return ProInsights() }
        let rows: [InsightRow] = (try? await AuthService.shared.client.from("matches")
            .select("player1_time,player1_score,created_at")
            .eq("player1_id", value: uid)
            .eq("winner_id", value: uid)
            .eq("game_mode", value: mode.rawValue)
            .is("player2_id", value: nil)
            .gt("player1_time", value: 0)
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
        async let words = wordInsights(uid: uid, mode: mode)
        async let streak = modeWinStreak(uid: uid, mode: mode)
        async let peak = peakHour(uid: uid, mode: mode)
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
    private static func wordInsights(uid: String, mode: GameMode)
        async -> (nemesisWord: String?, nemesisLosses: Int, luckyWord: String?, luckyTime: Int, avgGuesses: Double, firstTryRate: Int) {
        struct Row: Decodable { let solutions: [String]?; let winner_id: String?; let player1_time: Double?; let player1_score: Int? }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("solutions,winner_id,player1_time,player1_score")
            .eq("player1_id", value: uid)
            .eq("game_mode", value: mode.rawValue)
            .not("solutions", operator: .is, value: "null")
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
    private static func modeWinStreak(uid: String, mode: GameMode) async -> (current: Int, best: Int) {
        struct Row: Decodable { let winner_id: String? }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("winner_id")
            .or("player1_id.eq.\(uid),player2_id.eq.\(uid)")
            .eq("game_mode", value: mode.rawValue)
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
    private static func peakHour(uid: String, mode: GameMode) async -> Int? {
        let buckets = await timeOfDay(mode: mode)
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
}
