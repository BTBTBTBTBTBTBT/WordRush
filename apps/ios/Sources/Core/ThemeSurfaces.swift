import Foundation

/// Theme surfaces (FRIDAY-QUEUE item 25): the card / border / ink tokens a theme derives from its registry look.
/// Port of core theme-surfaces.ts; theme-surfaces-fixtures.json pins the output of web, Swift and Kotlin.
public enum ThemeSurfaces {
    public struct Input: Equatable, Sendable {
        public let card: String, ink: String, inkSecondary: String, accent: String, tabBar: String
        public init(card: String, ink: String, inkSecondary: String, accent: String, tabBar: String) {
            self.card = card; self.ink = ink; self.inkSecondary = inkSecondary; self.accent = accent; self.tabBar = tabBar
        }
    }

    public struct Tokens: Equatable, Sendable {
        public let surface, surfaceHover, surfaceAlt, border, borderAlt, borderLight, divider: String
        public let text, textSecondary, textMuted, tabBar, tabEdge: String
    }

    private static func parse(_ hex: String) -> (Double, Double, Double) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        return (Double((v >> 16) & 0xFF), Double((v >> 8) & 0xFF), Double(v & 0xFF))
    }

    private static func to2(_ n: Double) -> String {
        let c = Int(max(0, min(255, n.rounded(.toNearestOrAwayFromZero))))
        return String(format: "%02X", c)
    }

    /// `a` toward `b` by `t` (0...1), per channel, rounded half up: "#RRGGBB".
    public static func mix(_ a: String, _ b: String, _ t: Double) -> String {
        let (ar, ag, ab) = parse(a), (br, bg, bb) = parse(b)
        return "#" + to2(ar + (br - ar) * t) + to2(ag + (bg - ag) * t) + to2(ab + (bb - ab) * t)
    }

    public static func tokens(_ l: Input) -> Tokens {
        Tokens(
            surface: l.card.uppercased(),
            surfaceHover: mix(l.card, l.accent, 0.08), surfaceAlt: mix(l.card, l.accent, 0.05),
            border: mix(l.card, l.accent, 0.24), borderAlt: mix(l.card, l.accent, 0.16),
            borderLight: mix(l.card, l.accent, 0.12), divider: mix(l.card, l.accent, 0.1),
            text: l.ink.uppercased(), textSecondary: l.inkSecondary.uppercased(),
            textMuted: mix(l.inkSecondary, l.card, 0.2),
            tabBar: l.tabBar.uppercased(), tabEdge: mix(l.tabBar, l.accent, 0.3))
    }
}
