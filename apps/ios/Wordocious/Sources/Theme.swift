import SwiftUI
import UIKit
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

    // Win/Loss pill + gold-highlight tokens — themed like the web's
    // --color-win-bg/loss-bg/win-text/loss-text/highlight-gold/gold-border(-light)
    // (dark theme swaps them to deep variants; ocean/forest keep the light values).
    static var winBG: Color { ThemeManager.shared.current.winBG }
    static var lossBG: Color { ThemeManager.shared.current.lossBG }
    static var winText: Color { ThemeManager.shared.current.winText }
    static var lossText: Color { ThemeManager.shared.current.lossText }
    static var highlightGold: Color { ThemeManager.shared.current.highlightGold }
    static var goldBorder: Color { ThemeManager.shared.current.goldBorder }
    static var goldBorderLight: Color { ThemeManager.shared.current.goldBorderLight }

    // Brand
    static let primary = Color(hex: 0x7C3AED)            // purple (hsl 263 70% 50%)
    static let wordmarkStart = Color(hex: 0xA78BFA)      // gradient #a78bfa → #ec4899
    static let wordmarkEnd = Color(hex: 0xEC4899)
    static let gold = Color(hex: 0xF59E0B)

    // Tiles — Royal palette (brand purple correct, amber present, slate absent;
    // matches the web --tile-* vars). Colorblind mode swaps to the
    // high-contrast palette (orange=correct, blue=present) for red-green
    // color blindness, matching the web [data-colorblind] overrides.
    private static var cb: Bool { ThemeManager.shared.colorblind }
    static var correct: Color { cb ? Color(hex: 0xF5793A) : Color(hex: 0x7C3AED) } // orange / violet-600
    static var present: Color { cb ? Color(hex: 0x85C0F9) : Color(hex: 0xF59E0B) } // blue / amber-500
    static let absent = Color(hex: 0x64748B)             // slate-500
    static let emptyBorder = Color(hex: 0xD1D5DB)        // Tailwind gray-300 (web board empty tile)
    static let keyDefault = Color(hex: 0xE8E5F0)

    // Keyboard keys use the darker 600/700-weight purple/amber + slate-400
    // (distinct from the lighter board tiles), matching the web --key-* vars.
    // Colorblind swaps to darker orange/blue (the 600-equivalents).
    static var keyCorrect: Color { cb ? Color(hex: 0xE8612A) : Color(hex: 0x6D28D9) } // orange-600 / violet-700
    static var keyPresent: Color { cb ? Color(hex: 0x6AAEF0) : Color(hex: 0xD97706) } // blue-600 / amber-600
    static let keyAbsent = Color(hex: 0x94A3B8)          // slate-400

    // Win/success accents (Royal): win pills, "Solved!" badges, board win
    // tints — web WIN_FG/WIN_BG/BOARD_WIN_TINT in lib/tile-theme.ts.
    static let win = Color(hex: 0x7C3AED)
    static let winSoftBG = Color(hex: 0xF5F3FF)          // violet-50
    static let boardWinTint = Color(hex: 0xF5F3FF)       // violet-50
    static let winBorder = Color(hex: 0xA78BFA)          // violet-400 (solved board border)

    /// Single reduced-motion source of truth: the in-app toggle OR the OS
    /// setting. Web kills every animation under BOTH [data-reduced-motion] and
    /// prefers-reduced-motion — every animation gates through this.
    static var reduceMotion: Bool {
        ThemeManager.shared.reducedMotion || UIAccessibility.isReduceMotionEnabled
    }

    /// Animation honoring the reduced-motion setting (nil = no animation).
    static func animation(_ a: Animation) -> Animation? {
        reduceMotion ? nil : a
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
        case .hintUsed: return Color(hex: 0xF3F4F6) // web HINT_USED tile = bg-gray-100 (faint, with gray-300 letter)
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

/// Nunito typography. Registered via UIAppFonts (Nunito.ttf, a VARIABLE font
/// whose default named instance is ExtraLight). SwiftUI's `.custom().weight()`
/// does NOT reliably drive a variable font's `wght` axis — it rendered most
/// "bold/black" text near ExtraLight, so the app looked far lighter than the web
/// (true Nunito 900). We instead build a UIFont with the `wght` variation axis
/// set explicitly so weights actually apply (matching the web's boldness).
enum Brand {
    /// Four-char code 'wght' as the variable-axis identifier.
    private static let wghtAxisID = 0x77676874
    private static var fontCache: [String: UIFont] = [:]

    private static func numericWeight(_ w: Font.Weight) -> CGFloat {
        switch w {
        case .ultraLight: return 200
        case .thin:       return 250
        case .light:      return 300
        case .medium:     return 500
        case .semibold:   return 600
        case .bold:       return 700
        case .heavy:      return 800
        case .black:      return 900
        default:          return 400   // .regular and anything unmapped
        }
    }

    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let wght = numericWeight(weight)
        let key = "\(size)-\(Int(wght))"
        if let cached = fontCache[key] { return Font(cached) }
        guard let base = UIFont(name: "Nunito", size: size) else {
            return .system(size: size, weight: weight, design: .rounded)
        }
        let desc = base.fontDescriptor.addingAttributes([
            UIFontDescriptor.AttributeName(rawValue: "NSCTFontVariationAttribute"): [wghtAxisID: wght],
        ])
        let uiFont = UIFont(descriptor: desc, size: size)
        fontCache[key] = uiFont
        return Font(uiFont)
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

    /// Parse a "#rrggbb" / "rrggbb" hex string (e.g. accent colors from the
    /// content/mode APIs). Returns nil on malformed input.
    init?(hexString: String) {
        let s = hexString.hasPrefix("#") ? String(hexString.dropFirst()) : hexString
        guard s.count == 6, let v = UInt(s, radix: 16) else { return nil }
        self.init(hex: v)
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
