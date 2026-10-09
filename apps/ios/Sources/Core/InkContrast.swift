import Foundation

/// FINISH_SPEC §AD: WCAG 2.x contrast math for the app's fixed inks over its
/// tinted surfaces (the native mirror of the web ink rules: text ≥ 4.5:1).
/// Colors are 0xRRGGBB. Pure, so the ink pairs are unit tested.
public enum InkContrast {
    /// Relative luminance (sRGB).
    public static func luminance(_ hex: UInt32) -> Double {
        func channel(_ shift: UInt32) -> Double {
            let c = Double((hex >> shift) & 0xFF) / 255
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
    }

    /// The contrast ratio between two colors (1…21).
    public static func ratio(_ a: UInt32, _ b: UInt32) -> Double {
        let la = luminance(a), lb = luminance(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
    }

    /// `color` at `amount` composited over `base` (CSS color-mix in srgb) — the
    /// app's `Color.mixed(over:_:)` / `Color.wash(_:)`.
    public static func mix(_ color: UInt32, over base: UInt32, _ amount: Double) -> UInt32 {
        let k = min(1, max(0, amount))
        func ch(_ v: UInt32, _ shift: UInt32) -> Double { Double((v >> shift) & 0xFF) }
        func out(_ shift: UInt32) -> UInt32 {
            let v = ch(base, shift) + (ch(color, shift) - ch(base, shift)) * k
            return UInt32(max(0, min(255, v.rounded())))
        }
        return (out(16) << 16) | (out(8) << 8) | out(0)
    }

    /// The label ink for text on a SOLID fill: white when it clears 4.5:1 (also on the fill pressed,
    /// black 12% over it), else the near-black #1A1A2E — a bright season tint (Halloween orange
    /// #F97316) carries dark text, never white at 2.8:1.
    public static func onSolid(_ fill: UInt32) -> UInt32 {
        let pressed = mix(0x000000, over: fill, 0.12)
        return min(ratio(0xFFFFFF, fill), ratio(0xFFFFFF, pressed)) >= 4.5 ? 0xFFFFFF : 0x1A1A2E
    }
}
