import SwiftUI

/// Active-theme palette: the subset of design tokens that change per theme
/// (surfaces / borders / text). Tiles, keyboard, and brand colors stay constant
/// across themes — matching the web, where `[data-theme]` only overrides the
/// `--color-*` surface/text variables (board tiles use fixed Tailwind colors).
struct Palette {
    let background: Color
    let backgroundGradientEnd: Color
    let surface: Color
    let border: Color
    let borderAlt: Color
    let borderLight: Color
    let divider: Color
    let surfaceAlt: Color
    let surfaceHover: Color
    let textPrimary: Color
    let textMuted: Color
    let textSecondary: Color
}

/// Drives app-wide theming. `theme` persists to the same `pref-theme`
/// UserDefaults key the Settings picker uses; `Theme.*` tokens read
/// `current`, and the app root rebuilds when this publishes so every screen
/// recolors live. Mirrors the web's theme-context (`[data-theme="…"]`).
final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()

    @Published var theme: String {
        didSet { UserDefaults.standard.set(theme, forKey: "pref-theme") }
    }

    private init() {
        theme = UserDefaults.standard.string(forKey: "pref-theme") ?? "default"
    }

    var current: Palette { Self.palettes[theme] ?? Self.palettes["default"]! }

    /// Dark needs `.dark` so system chrome (toggles, alerts, keyboards) adapts;
    /// the tinted light themes (ocean/forest) and default stay `.light`.
    var colorScheme: ColorScheme { theme == "dark" ? .dark : .light }

    static let palettes: [String: Palette] = [
        // Default — globals.css :root (light).
        "default": Palette(
            background: Color(hex: 0xF8F7FF), backgroundGradientEnd: Color(hex: 0xF3F0FF),
            surface: Color(hex: 0xFFFFFF), border: Color(hex: 0xEDE9F6),
            borderAlt: Color(hex: 0xE5E7EB), borderLight: Color(hex: 0xE0DAF0),
            divider: Color(hex: 0xF0F0F0), surfaceAlt: Color(hex: 0xF3F4F6),
            surfaceHover: Color(hex: 0xF3F0FF), textPrimary: Color(hex: 0x1A1A2E),
            textMuted: Color(hex: 0x9CA3AF), textSecondary: Color(hex: 0x6B7280)),

        // Dark — globals.css [data-theme="dark"].
        "dark": Palette(
            background: Color(hex: 0x1A1A2E), backgroundGradientEnd: Color(hex: 0x2E2E4A),
            surface: Color(hex: 0x252542), border: Color(hex: 0x3A3A5C),
            borderAlt: Color(hex: 0x3A3A5C), borderLight: Color(hex: 0x2E2E4A),
            divider: Color(hex: 0x3A3A5C), surfaceAlt: Color(hex: 0x2A2A48),
            surfaceHover: Color(hex: 0x2E2E4A), textPrimary: Color(hex: 0xF0EEF6),
            textMuted: Color(hex: 0x9CA3AF), textSecondary: Color(hex: 0xA0A0B8)),

        // Ocean — blue/teal-tinted light theme (web stub only recolored unused
        // tile vars; this is a full palette so the theme actually applies).
        "ocean": Palette(
            background: Color(hex: 0xF0F7FB), backgroundGradientEnd: Color(hex: 0xE3F0F7),
            surface: Color(hex: 0xFFFFFF), border: Color(hex: 0xCFE4EF),
            borderAlt: Color(hex: 0xD5E5EE), borderLight: Color(hex: 0xDDEBF3),
            divider: Color(hex: 0xE8F1F6), surfaceAlt: Color(hex: 0xEAF3F8),
            surfaceHover: Color(hex: 0xE3F0F7), textPrimary: Color(hex: 0x0F2E3D),
            textMuted: Color(hex: 0x6B8A99), textSecondary: Color(hex: 0x4A6B7A)),

        // Forest — green/earth-tinted light theme (full palette, see Ocean note).
        "forest": Palette(
            background: Color(hex: 0xF3F8F1), backgroundGradientEnd: Color(hex: 0xE8F2E4),
            surface: Color(hex: 0xFFFFFF), border: Color(hex: 0xD6E6CF),
            borderAlt: Color(hex: 0xDBE7D4), borderLight: Color(hex: 0xE0EBDA),
            divider: Color(hex: 0xECF3E9), surfaceAlt: Color(hex: 0xEDF4EA),
            surfaceHover: Color(hex: 0xE8F2E4), textPrimary: Color(hex: 0x1F3320),
            textMuted: Color(hex: 0x7A8C72), textSecondary: Color(hex: 0x56684F)),
    ]
}
