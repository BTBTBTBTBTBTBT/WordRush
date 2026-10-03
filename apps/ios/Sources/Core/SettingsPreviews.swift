import Foundation

/// FINISH_SPEC BI25: the live previews on the Settings THEME / KEYBOARD tiles, and
/// the single-fire rule for the header buttons that open a sheet. Parity:
/// Android `SettingsPreviews` (SettingsPreviewsTest), web `lib/settings-previews.ts`
/// (settings-previews.test.ts).
public enum SettingsPreviews {
    public struct Tile: Equatable {
        public let letter: String
        public let hex: Int
    }

    public struct ThemeSpec: Equatable {
        /// The theme's page wash behind the mini tiles.
        public let page: Int
        public let tiles: [Tile]
    }

    /// The preview word on every theme tile.
    public static let word = "WORD"

    /// Four mini glossy tiles in the theme's colors on its page wash.
    public static func theme(_ key: String) -> ThemeSpec {
        let colors: [Int]
        let page: Int
        switch key {
        case "dark": page = 0x1A1A2E; colors = [0x7C3AED, 0xF59E0B, 0x4C1D95, 0x475569]
        case "ocean": page = 0xE3F0F7; colors = [0x0EA5E9, 0x14B8A6, 0x0369A1, 0x67C6E3]
        case "forest": page = 0xE8F2E4; colors = [0x16A34A, 0xB45309, 0x166534, 0x84A98C]
        default: page = 0xF3F0FF; colors = [0x7C3AED, 0xF59E0B, 0x7C3AED, 0x94A3B8]   // "default" / "light"
        }
        let letters = word.map(String.init)
        return ThemeSpec(page: page, tiles: zip(letters, colors).map { Tile(letter: $0, hex: $1) })
    }

    public static let enter = "ENTER"
    public static let delete = "DEL"
    public static let space = "SPACE"

    /// The mini key rows: where Enter and Delete sit (mirrors the game keyboard's Z row,
    /// plus Michael's 4th row).
    public static func keyRows(_ layout: String) -> [[String]] {
        let letters = ["Z", "X", "C", "V"]
        switch layout {
        case "flipped": return [[delete] + letters + [enter]]
        case "michael": return [[delete] + letters + [delete], [enter, space, enter]]
        default: return [[enter] + letters + [delete]]
        }
    }

    /// Repeat taps within this window are the same tap (a double tap opens once).
    public static let sheetDebounce: TimeInterval = 0.6

    /// Whether a sheet-opening tap at `now` fires: never while a sheet is up or on its
    /// way, never within `sheetDebounce` of the last fire.
    public static func sheetTapFires(at now: Date, lastFire: Date?, presenting: Bool) -> Bool {
        if presenting { return false }
        guard let lastFire else { return true }
        let dt = now.timeIntervalSince(lastFire)
        return dt < 0 || dt >= sheetDebounce
    }
}
