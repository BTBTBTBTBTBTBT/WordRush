import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AD: every fixed ink the finishing kit draws on its tinted cards
/// keeps ≥ 4.5:1 in light AND dark mode (values mirror FinishKit.swift /
/// ThemeManager.swift / A11yInk.swift).
final class InkContrastTests: XCTestCase {
    private let white: UInt32 = 0xFFFFFF
    /// ThemeManager "dark" surface.
    private let darkSurface: UInt32 = 0x252542
    /// Page / game accents the tinted cards wash with.
    private let accents: [UInt32] = [0x7C3AED, 0xEC4899, 0xF5A524, 0x2563EB, 0x0D9488, 0xF97316, 0x6366F1]

    func testRatioBasics() {
        XCTAssertEqual(InkContrast.ratio(0x000000, 0xFFFFFF), 21, accuracy: 0.01)
        XCTAssertEqual(InkContrast.ratio(0x777777, 0x777777), 1, accuracy: 0.0001)
        XCTAssertEqual(InkContrast.mix(0x000000, over: 0xFFFFFF, 0.5), 0x808080)
    }

    /// Light: FinishInk.title / softNumber / muted on the card (8%) and pill (14%) washes.
    func testLightKitInks() {
        for a in accents {
            for wash in [0.08, 0.10, 0.14] {
                let bg = InkContrast.mix(a, over: white, wash)
                for ink: UInt32 in [0x2A1650, 0x3B1A78, 0x6F5F8F] {
                    XCTAssertGreaterThanOrEqual(InkContrast.ratio(ink, bg), 4.5,
                        String(format: "ink %06X on %06X", ink, bg))
                }
            }
        }
    }

    /// Dark: the flipping inks (Theme.textPrimary / textSecondary / textMuted,
    /// FinishInk.softNumberDark) on the dark surface + a faint accent.
    func testDarkKitInks() {
        for a in accents {
            let bg = InkContrast.mix(a, over: darkSurface, 0.10)
            for ink: UInt32 in [0xF0EEF6, 0xA0A0B8, 0x9CA3AF, 0xE9DDFF] {
                XCTAssertGreaterThanOrEqual(InkContrast.ratio(ink, bg), 4.5,
                    String(format: "ink %06X on %06X", ink, bg))
            }
        }
    }

    /// A11yInk.on: the deep colored inks fail on dark surfaces (why it exists) and
    /// their 45% tint passes.
    func testA11yInkDarkTint() {
        let inks: [UInt32] = [0x6D28D9, 0x7C3AED, 0xB45309, 0xBE185D, 0x92400E]
        for a in accents {
            let bg = InkContrast.mix(a, over: darkSurface, 0.10)
            for ink in inks {
                let tint = InkContrast.mix(ink, over: white, 0.45)
                XCTAssertGreaterThanOrEqual(InkContrast.ratio(tint, bg), 4.5,
                    String(format: "tint of %06X on %06X", ink, bg))
            }
        }
        XCTAssertLessThan(InkContrast.ratio(0x6D28D9, InkContrast.mix(0x7C3AED, over: darkSurface, 0.10)), 4.5)
    }

    /// The deep inks A11yInk keeps in light mode, on the washes they sit on.
    func testA11yInkLightPairs() {
        let purpleCard = InkContrast.mix(0x7C3AED, over: white, 0.12)
        let goldPill = InkContrast.mix(0xF5A524, over: white, 0.12)
        XCTAssertGreaterThanOrEqual(InkContrast.ratio(0x6D28D9, purpleCard), 4.5)
        XCTAssertGreaterThanOrEqual(InkContrast.ratio(0x7C3AED, purpleCard), 4.5)
        XCTAssertGreaterThanOrEqual(InkContrast.ratio(0xB45309, goldPill), 4.5)
        XCTAssertGreaterThanOrEqual(InkContrast.ratio(0x92400E, goldPill), 4.5)
    }
}
