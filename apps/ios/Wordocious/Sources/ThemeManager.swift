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
    // Win/Loss pills + gold-highlight rows — web themes these in dark
    // (globals.css --color-win-bg/loss-bg/win-text/loss-text/highlight-gold/
    // gold-border/gold-border-light); the light themes share the :root values.
    var winBG = Color(hex: 0xF5F3FF)
    var lossBG = Color(hex: 0xFEE2E2)
    var winText = Color(hex: 0x7C3AED)
    var lossText = Color(hex: 0xDC2626)
    var highlightGold = Color(hex: 0xFFFBEB)
    var goldBorder = Color(hex: 0xFDE68A)
    var goldBorderLight = Color(hex: 0xFEF3C7)
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
    /// High-contrast tile palette (orange=correct, blue=present) for red-green
    /// color blindness. Read by `Theme.correct/present/...` at render time, so
    /// it applies to the next game screen without a root rebuild.
    @Published var colorblind: Bool {
        didSet { UserDefaults.standard.set(colorblind, forKey: "pref-colorblind") }
    }
    /// When on, animations are skipped (gated at call sites via `Theme.animation`).
    @Published var reducedMotion: Bool {
        didSet { UserDefaults.standard.set(reducedMotion, forKey: "pref-reduced-motion") }
    }

    private init() {
        let d = UserDefaults.standard
        theme = d.string(forKey: "pref-theme") ?? "default"
        // Toggles default ON only if explicitly set; absent → false.
        colorblind = d.bool(forKey: "pref-colorblind")
        reducedMotion = d.bool(forKey: "pref-reduced-motion")
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

        // Dark — globals.css [data-theme="dark"], incl. the win/loss/gold
        // overrides (globals.css:41-48) so pills/highlights stop rendering
        // light-theme pastels on dark surfaces.
        "dark": Palette(
            background: Color(hex: 0x1A1A2E), backgroundGradientEnd: Color(hex: 0x2E2E4A),
            surface: Color(hex: 0x252542), border: Color(hex: 0x3A3A5C),
            borderAlt: Color(hex: 0x3A3A5C), borderLight: Color(hex: 0x2E2E4A),
            divider: Color(hex: 0x3A3A5C), surfaceAlt: Color(hex: 0x2A2A48),
            surfaceHover: Color(hex: 0x2E2E4A), textPrimary: Color(hex: 0xF0EEF6),
            textMuted: Color(hex: 0x9CA3AF), textSecondary: Color(hex: 0xA0A0B8),
            winBG: Color(hex: 0x2E1065), lossBG: Color(hex: 0x450A0A),
            winText: Color(hex: 0xA78BFA), lossText: Color(hex: 0xF87171),
            highlightGold: Color(hex: 0x422006), goldBorder: Color(hex: 0x92400E),
            goldBorderLight: Color(hex: 0x78350F)),

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
