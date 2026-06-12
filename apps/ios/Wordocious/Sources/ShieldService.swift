import Foundation

/// Streak-shield logic — ports apps/web/lib/shield-service.ts. A shield lets a
/// player protect their daily-login streak when they miss a day; Pro grants 4
/// per billing period (plus a free one every 7-day login milestone).
enum ShieldService {
    /// Is the player's streak at risk? (>20h since last play AND the local
    /// calendar day has rolled over — matches the daily-reset boundary.)
    static func isStreakAtRisk(lastPlayedAt: String?) -> Bool {
        guard let s = lastPlayedAt, let last = parseTimestamp(s) else { return false }
        let hoursSince = Date().timeIntervalSince(last) / 3600
        guard hoursSince > 20 else { return false }
        return localDay(last) != LeaderboardService.todayLocal()
    }

    /// Spend a shield to preserve the streak by bumping last_played_at to now.
    /// Returns true on success (false if the player has no shields).
    @discardableResult
    static func useShield() async -> Bool {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return false }
        struct Row: Decodable { let streak_shields: Int }
        guard let row: Row = try? await client.from("profiles")
            .select("streak_shields").eq("id", value: uid).single().execute().value,
              row.streak_shields > 0 else { return false }
        struct Upd: Encodable { let streak_shields: Int; let last_played_at: String }
        try? await client.from("profiles")
            .update(Upd(streak_shields: row.streak_shields - 1,
                        last_played_at: ISO8601DateFormatter().string(from: Date())))
            .eq("id", value: uid).execute()
        await AuthService.shared.refreshProfile()
        return true
    }

    /// Decline the shield — reset the daily-login streak to 0.
    static func declineStreak() async {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return }
        struct Upd: Encodable { let daily_login_streak: Int }
        try? await client.from("profiles")
            .update(Upd(daily_login_streak: 0)).eq("id", value: uid).execute()
        await AuthService.shared.refreshProfile()
    }

    private static func localDay(_ date: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        return f.string(from: date)
    }
}
