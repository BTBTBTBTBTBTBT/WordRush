import Foundation

/// A player's own mascot-maker colors (founder 10-09), for surfaces that wear them: the podium stat plates (their
/// backdrop as the fill, their frame as the border, ink chosen for contrast) and their name in the bubble lettering.
/// Pure hex math, Swift port of packages/core/src/player-tint.ts, pinned to it by player-tint-fixtures.json
/// (PlayerTintFixtureTests). The app's `PlayerTint` (FinishPages.swift) turns these hexes into SwiftUI colors.
public enum PlayerTintCore {
    public struct Plate: Equatable {
        public let fill: [String]
        public let border: [String]
        public let borderWidth: Double
        /// True = light (white) ink on a dark fill; false = the dark purple ink on a light fill.
        public let lightInk: Bool
    }

    private static func rgb(_ hex: String) -> (Double, Double, Double) {
        var s = hex; if s.hasPrefix("#") { s.removeFirst() }
        let v = Int(s, radix: 16) ?? 0
        return (Double((v >> 16) & 0xff) / 255, Double((v >> 8) & 0xff) / 255, Double(v & 0xff) / 255)
    }

    private static func byteHex(_ v: Double) -> String {
        String(format: "%02x", Int(v.rounded()))
    }

    /// Blend two hexes (t = 0 gives a, 1 gives b), as lowercase #rrggbb.
    public static func mix(_ a: String, _ b: String, _ t: Double) -> String {
        let x = rgb(a), y = rgb(b)
        func c(_ p: Double, _ q: Double) -> Double { (p + (q - p) * t) * 255 }
        return "#" + byteHex(c(x.0, y.0)) + byteHex(c(x.1, y.1)) + byteHex(c(x.2, y.2))
    }

    /// WCAG relative luminance (0 black ... 1 white).
    public static func luminance(_ hex: String) -> Double {
        func lin(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        let (r, g, b) = rgb(hex)
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }

    /// The backdrop's colors ("auto" / unknown = a light tint of the body color). A pattern reads as its base color plus a whisper of its accent.
    public static func backdropHexes(bg: String, bodyHex: String) -> [String] {
        guard let b = AvatarCatalog.backdrop(bg) else { return [mix(bodyHex, "#ffffff", 0.78)] }
        return b.kind == .pattern ? [b.colors[0], mix(b.colors[0], b.colors[1], 0.3)] : b.colors
    }

    /// The frame's metal as a border gradient; "none" = a deeper shade of the fill so every plate has an edge.
    public static func frameHexes(_ frame: String, fill: [String]) -> (colors: [String], width: Double) {
        switch frame {
        case "bronze": return (["#F0B27A", "#B45309"], 2.5)
        case "silver": return (["#F8FAFC", "#94A3B8"], 2.5)
        case "gold": return (["#FDE68A", "#D97706"], 2.5)
        case "platinum": return (["#E0F2FE", "#64748B"], 2.5)
        case "diamond": return (["#A5F3FC", "#818CF8", "#F0ABFC"], 2.5)
        case "pro": return (["#F5B82E", "#EC4899", "#8B5CF6"], 2.5)
        default: return ([mix(fill[0], "#000000", 0.28)], 1.5)
        }
    }

    public static func plateHexes(bg: String, frame: String, bodyHex: String) -> Plate {
        let fill = backdropHexes(bg: bg, bodyHex: bodyHex)
        let edge = frameHexes(frame, fill: fill)
        let lum = fill.map(luminance).reduce(0, +) / Double(max(1, fill.count))
        return Plate(fill: fill, border: edge.colors, borderWidth: edge.width, lightInk: lum < 0.42)
    }

    private static func toHsb(_ hex: String) -> (Double, Double, Double) {
        let (r, g, b) = rgb(hex)
        let mx = max(r, g, b), mn = min(r, g, b), d = mx - mn
        var h = 0.0
        if d > 0 {
            if mx == r { h = ((g - b) / d).truncatingRemainder(dividingBy: 6) }
            else if mx == g { h = (b - r) / d + 2 }
            else { h = (r - g) / d + 4 }
            h /= 6
            if h < 0 { h += 1 }
        }
        return (h, mx == 0 ? 0 : d / mx, mx)
    }

    private static func fromHsb(_ h: Double, _ s: Double, _ v: Double) -> String {
        let i = Int((h * 6).rounded(.down)) % 6
        let f = h * 6 - (h * 6).rounded(.down)
        let p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
        let (r, g, b): (Double, Double, Double)
        switch i {
        case 0: (r, g, b) = (v, t, p)
        case 1: (r, g, b) = (q, v, p)
        case 2: (r, g, b) = (p, v, t)
        case 3: (r, g, b) = (p, q, v)
        case 4: (r, g, b) = (t, p, v)
        default: (r, g, b) = (v, p, q)
        }
        return "#" + byteHex(r * 255) + byteHex(g * 255) + byteHex(b * 255)
    }

    /// A vivid version of the player's backdrop color, for their name in the bubble lettering (lemon gives a sunny gold).
    public static func nameHex(bg: String, bodyHex: String) -> String {
        let base = AvatarCatalog.backdrop(bg)?.colors.last ?? bodyHex
        let (h, s, v) = toHsb(base)
        if s < 0.12 { return "#8B5CF6" }   // a grey / white backdrop: the brand purple
        return fromHsb(h, max(s, 0.78), max(v, 0.92))
    }
}
