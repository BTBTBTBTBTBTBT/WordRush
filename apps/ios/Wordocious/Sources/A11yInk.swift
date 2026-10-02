import SwiftUI

/// FINISH_SPEC §AD: colored text on the §A1 tinted cards / pills must keep ≥ 4.5:1
/// in BOTH themes. Those cards flip to the dark surface (`Theme.surface` + a faint
/// accent) in dark mode, where the deep light-theme inks (#6D28D9, #7C3AED, #B45309…)
/// drop to ~2:1. `A11yInk.on(c)` keeps the deep color on light washes and swaps in a
/// light tint of it (45% over white) on dark surfaces. Use it only where the
/// background flips — not on fixed light chips (gold PRO pills, pastel badges).
/// The ratios are unit tested (Core `InkContrast`, Tests/InkContrastTests.swift).
enum A11yInk {
    /// The share of the color kept in the dark-mode tint.
    static let darkTint: Double = 0.45

    static func on(_ c: Color) -> Color {
        Theme.isDark ? c.mixed(over: .white, darkTint) : c
    }
}
