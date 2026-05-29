import SwiftUI
import WordociousCore

/// Brand palette mirrored from the web app (Tailwind green-500 / yellow-500 /
/// gray + the #f8f7ff lavender background).
enum Theme {
    static let background = Color(hex: 0xF8F7FF)
    static let backgroundGradientEnd = Color(hex: 0xEDE5FF)
    static let correct = Color(hex: 0x22C55E)   // green-500
    static let present = Color(hex: 0xEAB308)   // yellow-500
    static let absent = Color(hex: 0x6B7280)     // gray-500
    static let emptyBorder = Color(hex: 0xD8D2E8)
    static let keyDefault = Color(hex: 0xE8E5F0)
    static let textPrimary = Color(hex: 0x1F1B2E)

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
