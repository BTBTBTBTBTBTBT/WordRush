import Foundation

/// ART_SPEC §20 (founder, 2026-10-02): a player with no uploaded photo is drawn
/// as a glossy letter tile instead of an initials circle. This is the pure part —
/// the initials and the tile's colors — shared by every avatar so the pick cannot
/// drift between screens (web and Android carry the same rules).
public enum LetterTileColor {
    /// The mascot cast: these letters wear their character's color.
    public static let cast: [Character: UInt] = [
        "W": 0x8B2CF5, "O": 0xFF2F91, "R": 0x8E96A8, "D": 0x0A6CFF,
        "C": 0x00B4BE, "I": 0x4CC77A, "U": 0x9B3DF3, "S": 0xF5A623,
    ]

    /// Every other first character: palette[(uppercase char code) mod 9].
    public static let palette: [UInt] = [
        0x8B2CF5, 0xFF9F1A, 0x0A6CFF, 0xFF2F91, 0x00B4BE, 0x4CC77A, 0x9B3DF3, 0xF5A623, 0xF0782C,
    ]

    private static func cleaned(_ username: String) -> String {
        username.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// First two characters of the username, uppercased (one if the name has
    /// one); "?" for an empty name (web/Android parity).
    public static func initials(_ username: String) -> String {
        let s = String(cleaned(username).prefix(2)).uppercased()
        return s.isEmpty ? "?" : s
    }

    /// The tile's `base` color as 0xRRGGBB: the player's chosen accent wins when
    /// one is set (a parseable "#RRGGBB"); otherwise the cast color of the first
    /// letter, else the palette by (uppercase char code) mod 9. An empty name
    /// reads as "?" (63 mod 9 = palette[0]).
    public static func baseHex(username: String, accentHex: String? = nil) -> UInt {
        if let accent = parseHex(accentHex) { return accent }
        guard let first = cleaned(username).uppercased().first else { return palette[0] }
        if let c = cast[first] { return c }
        let code = first.unicodeScalars.first.map { Int($0.value) } ?? 0
        return palette[code % palette.count]
    }

    /// "#RRGGBB" / "RRGGBB" → 0xRRGGBB, nil when absent or malformed.
    public static func parseHex(_ s: String?) -> UInt? {
        guard let t = s?.trimmingCharacters(in: CharacterSet(charactersIn: "# ")), t.count == 6,
              let v = UInt(t, radix: 16) else { return nil }
        return v
    }

    /// Mix toward black by `amount` (0…1): `edge` = darken(base, 0.22).
    public static func darken(_ hex: UInt, _ amount: Double) -> UInt {
        mix(hex, toward: 0, amount)
    }

    /// Mix toward white by `amount` (0…1): `light` = lighten(base, 0.18).
    public static func lighten(_ hex: UInt, _ amount: Double) -> UInt {
        mix(hex, toward: 255, amount)
    }

    private static func mix(_ hex: UInt, toward target: Double, _ amount: Double) -> UInt {
        let a = min(1, max(0, amount))
        func ch(_ shift: UInt) -> UInt {
            let v = Double((hex >> shift) & 0xFF)
            return UInt(min(255, max(0, (v + (target - v) * a).rounded())))
        }
        return (ch(16) << 16) | (ch(8) << 8) | ch(0)
    }
}
