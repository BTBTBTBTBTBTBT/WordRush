import Foundation
import Supabase
import WordociousCore

/// Data behind the home banner's row streaks and Unlimited counts, and the Word
/// of the Day quiz answers (founder-approved home redesign, 2026-10-01). Mirrors
/// web lib/home-streaks.ts. The rules themselves (what counts as a sweep, how a
/// run is counted) live in HomeBanner (WordociousCore) so every platform counts
/// exactly the same way.
enum HomeStreaksService {
    /// How far back the Puzzles and word streaks look (a ~13-month run is plenty).
    static let lookbackDays = 400

    private static func sinceDay() -> String {
        HomeBanner.shiftDay(LeaderboardService.todayLocal(), -lookbackDays)
    }

    private static func userId() async -> String? {
        // Postgres returns uuids lowercase; keep compares consistent.
        (try? await AuthService.shared.client.auth.session.user.id.uuidString)?.lowercased()
    }

    /// The Puzzles row's sweep and flawless runs: days in a row the player finished
    /// (and won) every one of the More Games dailies. `dbKeys` are the VISIBLE More
    /// Games daily modes; a day needs all of them.
    static func puzzleStreaks(dbKeys: [String]) async -> GroupStreaks {
        guard !dbKeys.isEmpty, let uid = await userId() else { return GroupStreaks(sweep: 0, flawless: 0) }
        struct Row: Decodable { let day: String; let game_mode: String; let completed: Bool }
        let rows: [Row] = (try? await AuthService.shared.client.from("daily_results")
            .select("day, game_mode, completed")
            .eq("user_id", value: uid)
            .eq("play_type", value: "solo")
            .in("game_mode", values: dbKeys)
            .gte("day", value: sinceDay())
            .execute().value) ?? []
        var played: [String: Set<String>] = [:]
        var won: [String: Set<String>] = [:]
        for r in rows {
            played[r.day, default: []].insert(r.game_mode)
            if r.completed { won[r.day, default: []].insert(r.game_mode) }
        }
        var days: [String: DayCount] = [:]
        for (day, set) in played { days[day] = DayCount(played: set.count, won: won[day]?.count ?? 0) }
        return HomeBanner.dayStreaks(days, total: dbKeys.count, today: LeaderboardService.todayLocal())
    }

    /// Unlimited mode's "N PLAYED TODAY": the player's finished non-daily solo games
    /// since local midnight, per game_mode. Daily seeds and VS matches don't count.
    /// Three narrow columns over today's own rows (matches RLS: participants only).
    static func unlimitedCountsToday() async -> [String: Int] {
        guard let uid = await userId() else { return [:] }
        let midnight = Calendar.current.startOfDay(for: Date())
        let iso = ISO8601DateFormatter()
        iso.timeZone = TimeZone(identifier: "UTC")
        struct Row: Decodable { let game_mode: String; let seed: String?; let player2_id: String? }
        let rows: [Row] = (try? await AuthService.shared.client.from("matches")
            .select("game_mode, seed, player2_id")
            .eq("player1_id", value: uid)
            .gte("created_at", value: iso.string(from: midnight))
            .limit(500)
            .execute().value) ?? []
        var counts: [String: Int] = [:]
        for m in rows {
            guard m.player2_id == nil, let seed = m.seed, !seed.isEmpty, !isDailySeed(seed) else { continue }
            counts[m.game_mode, default: 0] += 1
        }
        return counts
    }

    // MARK: - Launch cache for the row streaks

    enum StreakRow: String { case word, puzzles }

    /// The last computed streaks for a row, trusted only when stamped today or
    /// yesterday (a run that old can still be alive). Lets the flames paint on the
    /// first frame instead of popping in after the queries.
    static func cachedStreaks(_ row: StreakRow) -> GroupStreaks {
        let d = UserDefaults.standard
        let today = LeaderboardService.todayLocal()
        guard let day = d.string(forKey: "home-streaks-\(row.rawValue)-day"),
              day == today || day == HomeBanner.shiftDay(today, -1) else { return GroupStreaks(sweep: 0, flawless: 0) }
        return GroupStreaks(sweep: d.integer(forKey: "home-streaks-\(row.rawValue)-sweep"),
                            flawless: d.integer(forKey: "home-streaks-\(row.rawValue)-flawless"))
    }

    static func storeStreaks(_ s: GroupStreaks, _ row: StreakRow) {
        let d = UserDefaults.standard
        d.set(LeaderboardService.todayLocal(), forKey: "home-streaks-\(row.rawValue)-day")
        d.set(s.sweep, forKey: "home-streaks-\(row.rawValue)-sweep")
        d.set(s.flawless, forKey: "home-streaks-\(row.rawValue)-flawless")
    }

    // MARK: - Word of the Day quiz

    struct QuizAnswer: Codable, Equatable {
        let picked: Int
        let correct: Bool
    }

    /// Guest answers live on the device under the same key the web uses in localStorage.
    private static func guestKey(_ day: String) -> String { "wordocious-wotd-quiz-\(day)" }

    /// Today's saved answer (signed in: the database; guest: this device), plus the
    /// word streak (consecutive days answered right, ending today or yesterday).
    static func quizState(day: String) async -> (today: QuizAnswer?, streak: Int) {
        guard let uid = await userId() else {
            guard let data = UserDefaults.standard.data(forKey: guestKey(day)),
                  let v = try? JSONDecoder().decode(QuizAnswer.self, from: data) else { return (nil, 0) }
            return (v, 0)
        }
        struct Row: Decodable { let day: String; let picked: Int; let correct: Bool }
        let rows: [Row] = (try? await AuthService.shared.client.from("word_quiz_answers")
            .select("day, picked, correct")
            .eq("user_id", value: uid)
            .gte("day", value: sinceDay())
            .order("day", ascending: false)
            .limit(lookbackDays)
            .execute().value) ?? []
        var days: [String: DayCount] = [:]
        var today: QuizAnswer?
        for r in rows {
            days[r.day] = DayCount(played: 1, won: r.correct ? 1 : 0)
            if r.day == day { today = QuizAnswer(picked: r.picked, correct: r.correct) }
        }
        return (today, HomeBanner.dayStreaks(days, total: 1, today: day).flawless)
    }

    /// Saves the answer once (insert only). A second answer for the same day (another
    /// device got there first) is refused by the primary key; the first one stands.
    static func saveQuizAnswer(day: String, word: String, answer: QuizAnswer) async {
        guard let uid = await userId() else {
            if let data = try? JSONEncoder().encode(answer) { UserDefaults.standard.set(data, forKey: guestKey(day)) }
            return
        }
        struct Insert: Encodable { let user_id: String; let day: String; let word: String; let picked: Int; let correct: Bool }
        _ = try? await AuthService.shared.client.from("word_quiz_answers")
            .insert(Insert(user_id: uid, day: day, word: word, picked: answer.picked, correct: answer.correct))
            .execute()
    }
}
