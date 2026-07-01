import Foundation

/// Client-side progression for CPU practice (the fun/addictive layer). Persisted
/// per-device in UserDefaults — CPU play is unranked, and these are lightweight
/// bragging-rights numbers. W/L totals live in user_stats(vs_cpu); this tracks
/// the streak, boss-ladder rung, cosmetic unlocks, and Bot-of-the-Day streak.
/// Swift port of apps/web/lib/bot/cpu-progression.ts.
struct CpuProgression: Codable {
    var streak = 0
    var bestStreak = 0
    var rung = 0
    var unlocked: [String] = []
    var botOfDayStreak = 0
    var botOfDayLastDay: String? = nil
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
    }

    /// Fold a finished CPU game into progression. Call once per CPU match end.
    static func recordGame(won: Bool, tier: BotTier, personaId: String) -> Outcome {
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
        save(p)
        return Outcome(progression: p, milestone: milestone, unlockedPersona: unlockedPersona)
    }

    /// Record a Bot-of-the-Day result against today's UTC date (yyyy-MM-dd).
    @discardableResult
    static func recordBotOfDay(won: Bool, todayUtc: String) -> CpuProgression {
        var p = load()
        if won && p.botOfDayLastDay != todayUtc {
            let fmt = DateFormatter()
            fmt.calendar = Calendar(identifier: .gregorian)
            fmt.timeZone = TimeZone(identifier: "UTC")
            fmt.dateFormat = "yyyy-MM-dd"
            var yesterday: String? = nil
            if let d = fmt.date(from: todayUtc) {
                yesterday = fmt.string(from: d.addingTimeInterval(-86400))
            }
            p.botOfDayStreak = (p.botOfDayLastDay == yesterday) ? p.botOfDayStreak + 1 : 1
            p.botOfDayLastDay = todayUtc
            save(p)
        }
        return p
    }
}
