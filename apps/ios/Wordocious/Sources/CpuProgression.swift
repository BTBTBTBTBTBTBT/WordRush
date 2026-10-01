import Foundation
import WordociousCore

/// Client-side progression for bot games (the fun/addictive layer). Persisted
/// per-device in UserDefaults — bot play is unranked, and these are lightweight
/// bragging-rights numbers. W/L totals live in user_stats(vs_cpu); this tracks
/// the streak, the old boss rung, cosmetic unlocks, the Bot-of-the-Day streak,
/// and (VS overhaul §7, 2026-10-01) the bot ladder plus today's Bot of the Day.
/// Swift port of apps/web/lib/bot/cpu-progression.ts.
struct CpuProgression: Codable {
    var streak = 0
    var bestStreak = 0
    var rung = 0
    var unlocked: [String] = []
    var botOfDayStreak = 0
    var botOfDayLastDay: String? = nil
    /// Ladder rungs cleared, 0–4 (VsLobby.ladderAfterGame).
    var ladderCleared = 0
    /// Wins in a row against the next ladder bot.
    var ladderRun = 0
    /// The UTC day the Bot of the Day was last played, and how it went (won|lost|draw).
    var botOfDayPlayedDay: String? = nil
    var botOfDayResult: String? = nil

    init() {}

    /// Every field decodes leniently: a store saved before a field existed must
    /// keep its streaks (synthesized Codable throws on a missing key, and a
    /// failed decode used to mean a fresh, zeroed progression).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        streak = try c.decodeIfPresent(Int.self, forKey: .streak) ?? 0
        bestStreak = try c.decodeIfPresent(Int.self, forKey: .bestStreak) ?? 0
        rung = try c.decodeIfPresent(Int.self, forKey: .rung) ?? 0
        unlocked = try c.decodeIfPresent([String].self, forKey: .unlocked) ?? []
        botOfDayStreak = try c.decodeIfPresent(Int.self, forKey: .botOfDayStreak) ?? 0
        botOfDayLastDay = try c.decodeIfPresent(String.self, forKey: .botOfDayLastDay)
        ladderCleared = try c.decodeIfPresent(Int.self, forKey: .ladderCleared) ?? 0
        ladderRun = try c.decodeIfPresent(Int.self, forKey: .ladderRun) ?? 0
        botOfDayPlayedDay = try c.decodeIfPresent(String.self, forKey: .botOfDayPlayedDay)
        botOfDayResult = try c.decodeIfPresent(String.self, forKey: .botOfDayResult)
    }

    var ladder: BotLadderState { BotLadderState(cleared: ladderCleared, run: ladderRun) }

    /// The ladder's next bot id (Adapt once every rung is cleared).
    var nextLadderBot: String {
        ladderCleared < VsLobby.ladderBots.count ? VsLobby.ladderBots[ladderCleared] : "adapt"
    }

    /// Today's Bot of the Day (UTC day): open until played, then its result.
    func botOfDay(todayUtc: String) -> VsDayResult {
        guard botOfDayPlayedDay == todayUtc else { return .open }
        return VsDayResult(rawValue: botOfDayResult ?? "") ?? .lost
    }

    /// The Bot-of-the-Day day streak as it stands today: alive only when the last
    /// win was today or yesterday (UTC).
    func liveBotOfDayStreak(todayUtc: String) -> Int {
        guard let last = botOfDayLastDay else { return 0 }
        return last == todayUtc || last == HomeBanner.shiftDay(todayUtc, -1) ? botOfDayStreak : 0
    }
}

enum CpuProgressionStore {
    private static let key = "wd_cpu_progression_v1"
    private static let milestones = [5, 10, 25, 50, 100]
    private static let tierRung: [BotTier: Int] = [.easy: 1, .medium: 2, .hard: 3]

    static func load() -> CpuProgression {
        guard let data = UserDefaults.standard.data(forKey: key),
              let p = try? JSONDecoder().decode(CpuProgression.self, from: data) else {
            return CpuProgression()
        }
        return p
    }

    private static func save(_ p: CpuProgression) {
        if let data = try? JSONEncoder().encode(p) { UserDefaults.standard.set(data, forKey: key) }
    }

    struct Outcome {
        var progression: CpuProgression
        var milestone: Int?
        var unlockedPersona: String?
        /// This game cleared a ladder rung (the bot id it cleared).
        var clearedRung: String?
    }

    /// Fold a finished bot game into progression. Call once per bot match end.
    /// `botId` is the kind's ladder id (CpuIdentity.botId); only games against
    /// the ladder's next bot move the ladder.
    static func recordGame(won: Bool, tier: BotTier, personaId: String, botId: String) -> Outcome {
        var p = load()
        var milestone: Int?
        var unlockedPersona: String?
        if won {
            p.streak += 1
            if p.streak > p.bestStreak { p.bestStreak = p.streak }
            if milestones.contains(p.streak) { milestone = p.streak }
            p.rung = max(p.rung, tierRung[tier] ?? 1)
            if tier == .hard && p.streak >= 3 { p.rung = max(p.rung, 4) }
            if tier == .hard && !p.unlocked.contains(personaId) {
                p.unlocked.append(personaId)
                unlockedPersona = personaId
            }
        } else {
            p.streak = 0
            if p.rung > 1 { p.rung -= 1 }
        }
        let before = p.ladderCleared
        let after = VsLobby.ladderAfterGame(p.ladder, botId: botId, won: won)
        p.ladderCleared = after.cleared
        p.ladderRun = after.run
        save(p)
        let cleared = after.cleared > before && before < VsLobby.ladderBots.count ? VsLobby.ladderBots[before] : nil
        return Outcome(progression: p, milestone: milestone, unlockedPersona: unlockedPersona, clearedRung: cleared)
    }

    /// Record a Bot-of-the-Day result against today's UTC date (yyyy-MM-dd):
    /// today's played day + result (spec §7), and the day streak on a win.
    @discardableResult
    static func recordBotOfDay(result: VsDayResult, todayUtc: String) -> CpuProgression {
        var p = load()
        let won = result == .won
        if won && p.botOfDayLastDay != todayUtc {
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.calendar = Calendar(identifier: .gregorian)
            fmt.timeZone = TimeZone(identifier: "UTC")
            fmt.dateFormat = "yyyy-MM-dd"
            var yesterday: String? = nil
            if let d = fmt.date(from: todayUtc) {
                yesterday = fmt.string(from: d.addingTimeInterval(-86400))
            }
            p.botOfDayStreak = (p.botOfDayLastDay == yesterday) ? p.botOfDayStreak + 1 : 1
            p.botOfDayLastDay = todayUtc
        }
        p.botOfDayPlayedDay = todayUtc
        p.botOfDayResult = result.rawValue
        save(p)
        return p
    }
}
