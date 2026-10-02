import Foundation
import WordociousCore

/// Subset of the `profiles` table needed by the app. Mirrors
/// apps/web/lib/database.types.ts (snake_case → keyDecodingStrategy).
struct Profile: Codable, Identifiable, Equatable {
    let id: String
    var username: String
    var avatarUrl: String?
    var isPro: Bool
    var proExpiresAt: String?
    var isBanned: Bool
    var isAdmin: Bool?
    /// §228: 'admin' | 'tester' accounts never request ads (see AdsConfig).
    var role: String?
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
    var lastPlayedAt: String?
    /// Stamped server-side on activity — powers the profile presence line.
    var lastSeenAt: String?
    var goldMedals: Int
    var silverMedals: Int
    var bronzeMedals: Int
    var createdAt: String?
    /// Server-persisted "Pro prompt dismissed" flag — web reads/writes this so
    /// the one-time streak upsell never re-shows across devices.
    var proPromptShown: Bool?
    // Personalization (migration 20260626000001) — all optional.
    var bio: String?
    var featuredAchievement: String?
    var accentColor: String?
    var favoriteMode: String?
    var avatarEmoji: String?
    /// PRIVATE PROFILES (migration 20260806000001): world-readable flag; when
    /// true, other players see only the teaser card and the four
    /// /api/profile/[id]/* endpoints 403 for them. Optional so decoding never
    /// breaks against a pre-migration cache.
    var isPrivate: Bool?
    /// Friends D3.5 (§294): per-category push prefs (race / challenge /
    /// nudge / feed); a missing key means ON. Optional so a pre-migration
    /// row or cache never breaks profile loading.
    var notificationPrefs: [String: Bool]?
    /// FINISH_SPEC §AH: the worn cast hero ("w" … "s") and level-tier frame
    /// ("bronze" … "diamond"). NOT in selectColumns — the columns may not exist
    /// yet; CastAvatars reads them in a separate best-effort query. Optional, so
    /// a row or cache without them decodes as nil.
    var avatarCastId: String?
    var avatarFrame: String?
    /// FINISH_SPEC §AN3: the build-your-own mascot (profiles.avatar_config jsonb).
    /// NOT in selectColumns — the column may not exist yet; MascotLooks reads it in
    /// a separate best-effort query. Lenient (never fails the row's decoding).
    var avatarConfig: AvatarConfigRaw?

    enum CodingKeys: String, CodingKey {
        case id, username, level, xp, bio
        case featuredAchievement = "featured_achievement"
        case accentColor = "accent_color"
        case favoriteMode = "favorite_mode"
        case avatarEmoji = "avatar_emoji"
        case avatarUrl = "avatar_url"
        case isPro = "is_pro"
        case proExpiresAt = "pro_expires_at"
        case isBanned = "is_banned"
        case isAdmin = "is_admin"
        case role
        case hasOnboarded = "has_onboarded"
        case totalWins = "total_wins"
        case totalLosses = "total_losses"
        case currentStreak = "current_streak"
        case bestStreak = "best_streak"
        case dailyLoginStreak = "daily_login_streak"
        case bestDailyLoginStreak = "best_daily_login_streak"
        case streakShields = "streak_shields"
        case lastPlayedAt = "last_played_at"
        case lastSeenAt = "last_seen_at"
        case goldMedals = "gold_medals"
        case silverMedals = "silver_medals"
        case bronzeMedals = "bronze_medals"
        case createdAt = "created_at"
        case proPromptShown = "pro_prompt_shown"
        case isPrivate = "is_private"
        case notificationPrefs = "notification_prefs"
        case avatarCastId = "avatar_cast_id"
        case avatarFrame = "avatar_frame"
        case avatarConfig = "avatar_config"
    }

    /// Columns to request from the profiles table. (social_links is fetched
    /// separately/optionally so a missing column never breaks profile loading.)
    static let selectColumns = "id,username,avatar_url,is_pro,pro_expires_at,is_banned,is_admin,role,has_onboarded,level,xp,total_wins,total_losses,current_streak,best_streak,daily_login_streak,best_daily_login_streak,streak_shields,last_played_at,last_seen_at,gold_medals,silver_medals,bronze_medals,created_at,pro_prompt_shown,bio,featured_achievement,accent_color,favorite_mode,avatar_emoji,is_private,notification_prefs"

    /// The stored Pro window as a date. Purchase fulfillment has to compare
    /// against this before writing — pro_expires_at holds time from sources the
    /// store knows nothing about (referral rewards, admin comps, stacked Day
    /// Passes), so anything that overwrites it instead of extending it destroys
    /// days the player already owns, with nothing to restore them from.
    var proExpiryDate: Date? { proExpiresAt.flatMap(parseTimestamp) }
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
    TimestampFormatters.withFrac.date(from: s) ?? TimestampFormatters.plain.date(from: s)
}

/// Built once — a formatter per call cost every list row a parse setup (founder, 2026-09-29: glitchy scrolling).
private enum TimestampFormatters {
    static let withFrac: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    static let plain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
}
