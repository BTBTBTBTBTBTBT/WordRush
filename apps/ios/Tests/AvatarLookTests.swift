import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AH pick-a-character avatars + level-tier frames (Android AvatarCastTest parity).
final class AvatarLookTests: XCTestCase {
    func testCastIdsAreTheTenHeroesInWordociousOrder() {
        XCTAssertEqual(AvatarCastRules.ids, ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"])
        for id in AvatarCastRules.ids {
            XCTAssertNotNil(AvatarCastRules.member(id), id)
            XCTAssertNotNil(AvatarCastRules.colorHex(id), id)
        }
        XCTAssertEqual(AvatarCastRules.name("w"), "Webster")
        XCTAssertEqual(AvatarCastRules.colorHex("w"), 0x7C3AED)
        XCTAssertEqual(AvatarCastRules.normalize(" O1 "), "o1")
        XCTAssertNil(AvatarCastRules.normalize("webster"))
        XCTAssertNil(AvatarCastRules.normalize(""))
        XCTAssertNil(AvatarCastRules.normalize(nil))
    }

    func testFramesUnlockByLevelTier() {
        XCTAssertEqual(AvatarFrameRules.keys, ["bronze", "silver", "gold", "platinum", "diamond"])
        XCTAssertEqual(AvatarFrameRules.unlocked(level: 0), [.bronze])
        XCTAssertEqual(AvatarFrameRules.unlocked(level: 26), [.bronze, .silver, .gold])
        XCTAssertTrue(AvatarFrameRules.isUnlocked("silver", level: 11))
        XCTAssertFalse(AvatarFrameRules.isUnlocked("silver", level: 10))
        XCTAssertFalse(AvatarFrameRules.isUnlocked("mythic", level: 500))
        XCTAssertEqual(AvatarFrameRules.effective("diamond", level: 99), nil)
        XCTAssertEqual(AvatarFrameRules.effective("Diamond", level: 100), "diamond")
        XCTAssertEqual(AvatarFrameRules.effective("gold", level: nil), "gold")
        XCTAssertNil(AvatarFrameRules.effective("", level: nil))
        XCTAssertEqual(AvatarFrameRules.artName("gold"), "art-frame-gold")
        for k in AvatarFrameRules.keys { XCTAssertNotNil(AvatarFrameRules.ringHex(k), k) }
        // Tier floors match LevelTier.forLevel.
        for t in LevelTier.allCases { XCTAssertEqual(LevelTier.forLevel(t.minLevel), t) }
    }

    func testSaveFallbackRules() {
        XCTAssertTrue(AvatarSaveRules.isMissingAvatarColumn("PGRST204: Could not find the 'avatar_cast_id' column of 'profiles' in the schema cache"))
        XCTAssertTrue(AvatarSaveRules.isMissingAvatarColumn("42703 column profiles.avatar_frame does not exist"))
        XCTAssertFalse(AvatarSaveRules.isMissingAvatarColumn("23505 duplicate key"))
        XCTAssertFalse(AvatarSaveRules.isMissingAvatarColumn(nil))
        XCTAssertEqual(AvatarSaveRules.resolve(server: "w", local: "o1"), "w")
        XCTAssertEqual(AvatarSaveRules.resolve(server: nil, local: "o1"), "o1")
        XCTAssertEqual(AvatarSaveRules.resolve(server: " ", local: ""), nil)
        XCTAssertEqual(AvatarSaveRules.castKey(userId: "ABC"), "avatar-cast-id:abc")
        XCTAssertEqual(AvatarSaveRules.frameKey(userId: "ABC"), "avatar-frame:abc")
    }
}
