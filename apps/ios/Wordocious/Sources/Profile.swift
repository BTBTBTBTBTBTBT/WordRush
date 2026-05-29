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

    enum CodingKeys: String, CodingKey {
        case id, username
        case avatarUrl = "avatar_url"
        case isPro = "is_pro"
        case proExpiresAt = "pro_expires_at"
        case isBanned = "is_banned"
        case hasOnboarded = "has_onboarded"
    }
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
