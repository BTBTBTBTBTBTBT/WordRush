import XCTest
@testable import WordociousCore

/// ART_SPEC §20: initials avatars become letter tiles — the color pick and the
/// initials, pinned so iOS matches web and Android.
final class LetterTileColorTests: XCTestCase {
    func testCastLettersWearTheirCharacterColor() {
        XCTAssertEqual(LetterTileColor.baseHex(username: "wordsmith"), 0x8B2CF5) // W
        XCTAssertEqual(LetterTileColor.baseHex(username: "Olive"), 0xFF2F91)     // O
        XCTAssertEqual(LetterTileColor.baseHex(username: "sam"), 0xF5A623)       // S
    }

    func testOtherCharactersUseThePaletteByCharCodeMod9() {
        // "A" = 65, 65 mod 9 = 2
        XCTAssertEqual(LetterTileColor.baseHex(username: "alex"), 0x0A6CFF)
        XCTAssertEqual(LetterTileColor.baseHex(username: "alex"), LetterTileColor.palette[2])
        // "B" = 66 → 3; digits follow the same rule: "7" = 55 → 1
        XCTAssertEqual(LetterTileColor.baseHex(username: "bo"), LetterTileColor.palette[3])
        XCTAssertEqual(LetterTileColor.baseHex(username: "7even"), LetterTileColor.palette[1])
    }

    func testAccentWins() {
        XCTAssertEqual(LetterTileColor.baseHex(username: "wordsmith", accentHex: "#2563EB"), 0x2563EB)
        XCTAssertEqual(LetterTileColor.baseHex(username: "alex", accentHex: "0D9488"), 0x0D9488)
        // An absent or malformed accent falls through to the letter.
        XCTAssertEqual(LetterTileColor.baseHex(username: "wordsmith", accentHex: nil), 0x8B2CF5)
        XCTAssertEqual(LetterTileColor.baseHex(username: "wordsmith", accentHex: ""), 0x8B2CF5)
        XCTAssertEqual(LetterTileColor.baseHex(username: "wordsmith", accentHex: "nope"), 0x8B2CF5)
    }

    func testInitials() {
        XCTAssertEqual(LetterTileColor.initials("brian"), "BR")
        XCTAssertEqual(LetterTileColor.initials("q"), "Q")
        XCTAssertEqual(LetterTileColor.initials(" doug "), "DO")
        XCTAssertEqual(LetterTileColor.initials(""), "?")
        XCTAssertEqual(LetterTileColor.baseHex(username: ""), LetterTileColor.palette[0])
    }

    func testShades() {
        XCTAssertEqual(LetterTileColor.darken(0xFFFFFF, 0.22), 0xC7C7C7)
        XCTAssertEqual(LetterTileColor.lighten(0x000000, 0.18), 0x2E2E2E)
        XCTAssertEqual(LetterTileColor.darken(0x8B2CF5, 0), 0x8B2CF5)
    }
}
