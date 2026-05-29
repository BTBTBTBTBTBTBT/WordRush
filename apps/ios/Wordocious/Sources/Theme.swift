import SwiftUI
import WordociousCore

/// Design tokens pulled 1:1 from the web app (apps/web/app/globals.css +
/// tailwind). Nunito is the brand typeface; the WORDOCIOUS wordmark uses a
/// purple→pink gradient.
enum Theme {
    // Surfaces / text (globals.css :root)
    static let background = Color(hex: 0xF8F7FF)        // --color-bg
    static let backgroundGradientEnd = Color(hex: 0xF3F0FF) // --color-surface-hover
    static let surface = Color(hex: 0xFFFFFF)            // --color-surface
    static let border = Color(hex: 0xEDE9F6)             // --color-border
    static let borderAlt = Color(hex: 0xE5E7EB)          // --color-border-alt
    static let surfaceAlt = Color(hex: 0xF3F4F6)         // --color-surface-alt
    static let textPrimary = Color(hex: 0x1A1A2E)        // --color-text
    static let textMuted = Color(hex: 0x9CA3AF)          // --color-text-muted
    static let textSecondary = Color(hex: 0x6B7280)      // --color-text-secondary

    // Brand
    static let primary = Color(hex: 0x7C3AED)            // purple (hsl 263 70% 50%)
    static let wordmarkStart = Color(hex: 0xA78BFA)      // gradient #a78bfa → #ec4899
    static let wordmarkEnd = Color(hex: 0xEC4899)
    static let gold = Color(hex: 0xF59E0B)

    // Tiles (default light theme — Tailwind green-500 / yellow-500 / gray-500)
    static let correct = Color(hex: 0x22C55E)
    static let present = Color(hex: 0xEAB308)
    static let absent = Color(hex: 0x6B7280)
    static let emptyBorder = Color(hex: 0xD8D2E8)
    static let keyDefault = Color(hex: 0xE8E5F0)

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
