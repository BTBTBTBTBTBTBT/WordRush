import Foundation

/// Subset of the `profiles` table needed by the app. Mirrors
/// apps/web/lib/database.types.ts (snake_case → keyDecodingStrategy).
struct Profile: Codable, Identifiable, Equatable {
    let id: String
    var username: String
    var avatarUrl: String?
    var isPro: Bool
    var proExpiresAt: String?
    var isBanned: Bool
    var hasOnboarded: Bool
    var level: Int
    var xp: Int
    var totalWins: Int
    var totalLosses: Int
    var currentStreak: Int
    var bestStreak: Int
    var dailyLoginStreak: Int
    var bestDailyLoginStreak: Int
    var streakShields: Int
    var goldMedals: Int
    var silverMedals: Int
    var bronzeMedals: Int
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, username, level, xp
        case avatarUrl = "avatar_url"
        case isPro = "is_pro"
        case proExpiresAt = "pro_expires_at"
        case isBanned = "is_banned"
        case hasOnboarded = "has_onboarded"
        case totalWins = "total_wins"
        case totalLosses = "total_losses"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case dailyLoginStreak = "daily_login_streak"
        case bestDailyLoginStreak = "best_daily_login_streak"
        case streakShields = "streak_shields"
        case goldMedals = "gold_medals"
        case silverMedals = "silver_medals"
        case bronzeMedals = "bronze_medals"
        case createdAt = "created_at"
    }

    /// Columns to request from the profiles table. (social_links is fetched
    /// separately/optionally so a missing column never breaks profile loading.)
    static let selectColumns = "id,username,avatar_url,is_pro,pro_expires_at,is_banned,has_onboarded,level,xp,total_wins,total_losses,current_streak,best_streak,daily_login_streak,best_daily_login_streak,streak_shields,gold_medals,silver_medals,bronze_medals,created_at"
}

/// Expiry-aware Pro check — 1:1 with apps/web/lib/pro.ts isProActive().
/// The raw is_pro boolean is a write-side marker that can stay true after
/// pro_expires_at passes; always gate Pro features through this.
func isProActive(_ profile: Profile?) -> Bool {
    guard let profile, profile.isPro else { return false }
    guard let expiry = profile.proExpiresAt else { return true } // legacy rows w/o expiry
    guard let date = parseTimestamp(expiry) else { return true }
    return date.timeIntervalSinceNow > 0
}

/// Lenient timestamp parse matching JS `new Date(...)`. Supabase returns
/// timestamps both with and without fractional seconds.
func parseTimestamp(_ s: String) -> Date? {
    let withFrac = ISO8601DateFormatter()
    withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = withFrac.date(from: s) { return d }
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return plain.date(from: s)
}
