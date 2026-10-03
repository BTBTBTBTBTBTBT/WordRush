import XCTest
@testable import WordociousCore

/// FINISH_SPEC BI25: Settings tile previews + single-fire sheet taps (parity ×3).
final class SettingsPreviewsTests: XCTestCase {
    func testThemePreviewsSpellWordInEachThemesColors() {
        for key in ["default", "dark", "ocean", "forest"] {
            let spec = SettingsPreviews.theme(key)
            XCTAssertEqual(spec.tiles.map(\.letter).joined(), "WORD")
            XCTAssertEqual(spec.tiles.count, 4)
        }
        XCTAssertEqual(SettingsPreviews.theme("dark").page, 0x1A1A2E)
        XCTAssertEqual(SettingsPreviews.theme("ocean").tiles[0].hex, 0x0EA5E9)
        XCTAssertEqual(SettingsPreviews.theme("forest").tiles[0].hex, 0x16A34A)
        XCTAssertEqual(SettingsPreviews.theme("light"), SettingsPreviews.theme("default"))
    }

    func testKeyRowsPlaceEnterAndDelete() {
        let e = SettingsPreviews.enter, d = SettingsPreviews.delete
        XCTAssertEqual(SettingsPreviews.keyRows("standard"), [[e, "Z", "X", "C", "V", d]])
        XCTAssertEqual(SettingsPreviews.keyRows("flipped"), [[d, "Z", "X", "C", "V", e]])
        XCTAssertEqual(SettingsPreviews.keyRows("michael"), [[d, "Z", "X", "C", "V", d], [e, SettingsPreviews.space, e]])
    }

    func testSheetTapIsSingleFire() {
        let t0 = Date(timeIntervalSince1970: 1000)
        XCTAssertTrue(SettingsPreviews.sheetTapFires(at: t0, lastFire: nil, presenting: false))
        XCTAssertFalse(SettingsPreviews.sheetTapFires(at: t0.addingTimeInterval(0.2), lastFire: t0, presenting: false))
        XCTAssertFalse(SettingsPreviews.sheetTapFires(at: t0.addingTimeInterval(2), lastFire: t0, presenting: true))
        XCTAssertTrue(SettingsPreviews.sheetTapFires(at: t0.addingTimeInterval(0.7), lastFire: t0, presenting: false))
    }
}
