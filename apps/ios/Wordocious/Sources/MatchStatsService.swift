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

    // MARK: Row decoders
    private struct ScoreRow: Decodable { let player1_score: Int?; let game_mode: String; let winner_id: String? }
    private struct DateWinRow: Decodable { let created_at: String; let winner_id: String?; let game_mode: String }
    private struct TimeRow: Decodable { let player1_time: Double?; let game_mode: String; let created_at: String }

    private static func userId() async -> String? {
        try? await AuthService.shared.client.auth.session.user.id.uuidString
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
}
