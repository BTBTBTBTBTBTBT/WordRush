import Foundation

// FINISH_SPEC §AH — pick-a-character avatars + level-tier frames (pure rules).
//
// A player can wear one of the ten WORDOCIOUS characters as their avatar (drawn on
// a tinted circle in that character's own color, BotCast) and a ring frame for any
// level tier they have reached. Both live on profiles (avatar_cast_id text null,
// avatar_frame text null). The columns may not exist yet: rows decode them as
// optional, and the app keeps the choice locally until the server takes it.
// Mirrors Android data/AvatarCast.kt (AvatarCast / AvatarFrame / AvatarSave).

/// The ten characters a player can wear, by their art id (`mascot-<id>`).
public enum AvatarCastRules {
    /// WORDOCIOUS order — the Edit Profile grid order.
    public static let ids: [String] = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]

    /// The stored value as a known character id, or nil (blank, unknown, malformed).
    public static func normalize(_ raw: String?) -> String? {
        guard let v = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), ids.contains(v) else { return nil }
        return v
    }

    /// The cast member drawn as this character (name + color), or nil.
    public static func member(_ castId: String?) -> BotCastMember? {
        guard let id = normalize(castId) else { return nil }
        return BotCast.members.first { $0.mascot == id }
    }

    /// The character's own color as 0xRRGGBB, or nil for an unknown id.
    public static func colorHex(_ castId: String?) -> UInt? {
        guard let m = member(castId) else { return nil }
        return UInt(m.color.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16)
    }

    /// "Webster", "Ollie", … for labels, or nil.
    public static func name(_ castId: String?) -> String? { member(castId)?.name }
}

extension LevelTier {
    /// The first level of the tier (bronze 1, silver 11, gold 26, platinum 51, diamond 100).
    public var minLevel: Int {
        switch self {
        case .bronze: return 1
        case .silver: return 11
        case .gold: return 26
        case .platinum: return 51
        case .diamond: return 100
        }
    }
}

/// The level-tier avatar frames (`art-frame-<tier>`, else a code-drawn ring).
public enum AvatarFrameRules {
    /// "bronze" … "diamond", lowest first.
    public static let keys: [String] = LevelTier.allCases.map(\.rawValue)

    public static func normalize(_ raw: String?) -> String? {
        guard let v = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), keys.contains(v) else { return nil }
        return v
    }

    public static func tier(_ key: String?) -> LevelTier? { normalize(key).flatMap(LevelTier.init(rawValue:)) }

    /// The code-drawn ring color (0xRRGGBB) while the frame art is missing.
    public static func ringHex(_ key: String?) -> UInt? {
        switch tier(key) {
        case .bronze: return 0xCD7F32
        case .silver: return 0xC0C7D2
        case .gold: return 0xF5C542
        case .platinum: return 0x9FE3E0
        case .diamond: return 0x8EC5FF
        case nil: return nil
        }
    }

    /// The image set the frame art ships under.
    public static func artName(_ key: String) -> String { "art-frame-\(key)" }

    /// Every tier the player at `level` has reached (bronze always).
    public static func unlocked(level: Int) -> [LevelTier] {
        LevelTier.allCases.filter { $0.minLevel <= max(1, level) }
    }

    public static func isUnlocked(_ key: String?, level: Int) -> Bool {
        guard let t = tier(key) else { return false }
        return t.minLevel <= max(1, level)
    }

    /// The frame to draw: the stored one when it is a known tier the player has
    /// reached (`level` nil = unknown level, trust the row), else none.
    public static func effective(_ stored: String?, level: Int?) -> String? {
        guard let k = normalize(stored) else { return nil }
        guard let level else { return k }
        return isUnlocked(k, level: level) ? k : nil
    }
}

/// The save-with-fallback rules for the two new profile columns.
public enum AvatarSaveRules {
    public static let castColumn = "avatar_cast_id"
    public static let frameColumn = "avatar_frame"

    /// True when a PostgREST / Postgres error says an avatar column does not exist
    /// yet (PGRST204 "Could not find the 'avatar_cast_id' column…", 42703 "column …
    /// does not exist").
    public static func isMissingAvatarColumn(_ message: String?) -> Bool {
        guard let m = message, m.contains(castColumn) || m.contains(frameColumn) else { return false }
        let l = m.lowercased()
        return m.contains("PGRST204") || m.contains("42703") || l.contains("schema cache")
            || l.contains("does not exist") || l.contains("could not find")
    }

    /// UserDefaults keys for the local copy (per account).
    public static func castKey(userId: String) -> String { "avatar-cast-id:\(userId.lowercased())" }
    public static func frameKey(userId: String) -> String { "avatar-frame:\(userId.lowercased())" }

    /// The player's own choice: the server value when the row carries one, else the
    /// local copy kept while the column was missing ("" = chose none).
    public static func resolve(server: String?, local: String?) -> String? {
        if let s = server?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty { return s }
        if let l = local?.trimmingCharacters(in: .whitespacesAndNewlines), !l.isEmpty { return l }
        return nil
    }
}
