import SwiftUI
import WordociousCore

/// Design tokens pulled 1:1 from the web app (apps/web/app/globals.css +
/// tailwind). Nunito is the brand typeface; the WORDOCIOUS wordmark uses a
/// purple→pink gradient.
enum Theme {
    // Surfaces / text — theme-driven (read the active palette from
    // ThemeManager, mirroring the web's `[data-theme]` --color-* overrides).
    // The app root rebuilds on theme change so these recolor everywhere.
    static var background: Color { ThemeManager.shared.current.background }                       // --color-bg
    static var backgroundGradientEnd: Color { ThemeManager.shared.current.backgroundGradientEnd } // --color-surface-hover
    static var surface: Color { ThemeManager.shared.current.surface }                             // --color-surface
    static var border: Color { ThemeManager.shared.current.border }                               // --color-border
    static var borderAlt: Color { ThemeManager.shared.current.borderAlt }                         // --color-border-alt
    static var borderLight: Color { ThemeManager.shared.current.borderLight }                     // --color-border-light
    static var divider: Color { ThemeManager.shared.current.divider }                             // --color-divider
    static var surfaceAlt: Color { ThemeManager.shared.current.surfaceAlt }                       // --color-surface-alt
    static var surfaceHover: Color { ThemeManager.shared.current.surfaceHover }                   // --color-surface-hover
    static var textPrimary: Color { ThemeManager.shared.current.textPrimary }                     // --color-text
    static var textMuted: Color { ThemeManager.shared.current.textMuted }                         // --color-text-muted
    static var textSecondary: Color { ThemeManager.shared.current.textSecondary }                 // --color-text-secondary

    // Brand
    static let primary = Color(hex: 0x7C3AED)            // purple (hsl 263 70% 50%)
    static let wordmarkStart = Color(hex: 0xA78BFA)      // gradient #a78bfa → #ec4899
    static let wordmarkEnd = Color(hex: 0xEC4899)
    static let gold = Color(hex: 0xF59E0B)

    // Tiles — Tailwind green-500 / yellow-500 / gray-500. Colorblind mode swaps
    // to the high-contrast palette (orange=correct, blue=present) for red-green
    // color blindness, matching the web [data-colorblind] overrides.
    private static var cb: Bool { ThemeManager.shared.colorblind }
    static var correct: Color { cb ? Color(hex: 0xF5793A) : Color(hex: 0x22C55E) } // orange / green-500
    static var present: Color { cb ? Color(hex: 0x85C0F9) : Color(hex: 0xEAB308) } // blue / yellow-500
    static let absent = Color(hex: 0x6B7280)
    static let emptyBorder = Color(hex: 0xD1D5DB)        // Tailwind gray-300 (web board empty tile)
    static let keyDefault = Color(hex: 0xE8E5F0)

    // Keyboard keys use the darker 600-weight green/yellow + gray-400 (distinct
    // from the lighter board tiles), matching the web keyboard.tsx palette.
    // Colorblind swaps to darker orange/blue (the 600-equivalents).
    static var keyCorrect: Color { cb ? Color(hex: 0xE8612A) : Color(hex: 0x16A34A) } // orange-600 / green-600
    static var keyPresent: Color { cb ? Color(hex: 0x6AAEF0) : Color(hex: 0xCA8A04) } // blue-600 / yellow-600
    static let keyAbsent = Color(hex: 0x9CA3AF)          // gray-400

    /// Animation honoring the reduced-motion setting (nil = no animation).
    static func animation(_ a: Animation) -> Animation? {
        ThemeManager.shared.reducedMotion ? nil : a
    }

    static let wordmarkGradient = LinearGradient(
        colors: [wordmarkStart, wordmarkEnd],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    static func tileColor(for state: TileState) -> Color {
        switch state {
        case .correct: return correct
        case .present: return present
        case .absent: return absent
        case .hintUsed: return present
        case .empty: return .clear
        }
    }

    /// Keyboard-key fill per letter state (darker than board tiles, like web).
    static func keyColor(for state: TileState) -> Color {
        switch state {
        case .correct: return keyCorrect
        case .present, .hintUsed: return keyPresent
        case .absent: return keyAbsent
        case .empty: return keyDefault
        }
    }
}

/// Nunito typography. Registered via UIAppFonts (Nunito.ttf, a variable font
/// covering ExtraLight→Black). Falls back to the system rounded font if the
/// bundle font ever fails to load.
enum Brand {
    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom("Nunito", size: size).weight(weight)
    }
    // Convenience matched to web usage
    static func wordmark(_ size: CGFloat = 20) -> Font { font(size, .black) }
    static func title(_ size: CGFloat = 24) -> Font { font(size, .black) }
    static func headline(_ size: CGFloat = 17) -> Font { font(size, .bold) }
    static func body(_ size: CGFloat = 16) -> Font { font(size, .semibold) }
    static func caption(_ size: CGFloat = 12) -> Font { font(size, .bold) }
}

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}

/// The WORDOCIOUS gradient wordmark, matching the web header.
struct Wordmark: View {
    var size: CGFloat = 20
    var body: some View {
        Text("WORDOCIOUS")
            .font(Brand.wordmark(size))
            .tracking(0.5)
            .foregroundStyle(Theme.wordmarkGradient)
            .lineLimit(1)
            .fixedSize()
    }
}
