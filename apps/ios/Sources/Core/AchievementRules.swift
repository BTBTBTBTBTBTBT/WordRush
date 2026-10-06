import Foundation

/// The listing rule from packages/core/src/achievement-rules.ts (SECRET_ACHIEVEMENT_KEYS + achievementListed): which
/// catalog entries a player's lists show. A `hidden` entry (tracking not shipped) never shows; a `secret` one (the
/// musical cast's tunes, MusicalCast.melodies) is awarded normally but shows only once the player has it. The catalog
/// itself is served by /api/achievements (AchievementCatalog in the app); MusicalCastTests pins this against
/// achievement-rules-fixtures.json (`catalog`) and musical-cast-fixtures.json (`listed`, `secrets`).
public enum AchievementRules {
    /// The secret keys (NEW_ACHIEVEMENTS entries with `secret: true`): awarded, but a locked one is never listed.
    public static let secretKeys: [String] = [
        "tune_little_lamb", "tune_little_star", "tune_ode_to_joy", "tune_happy_birthday", "tune_hot_cross_buns",
    ]

    /// Should a catalog entry show in a player's list? Hidden never; a secret only once the player has it.
    public static func listed(key: String, hidden: Bool?, secret: Bool?, unlocked: Set<String>) -> Bool {
        if hidden == true { return false }
        return secret != true || unlocked.contains(key)
    }
}
