import XCTest
@testable import WordociousCore

/// Same cases as packages/core/src/branded-invite.test.ts.
final class BrandedInviteTests: XCTestCase {
    func testCodesAndUrls() {
        XCTAssertEqual(BrandedInvite.clean(" ant5-ttzr "), "ANT5TTZR")
        XCTAssertTrue(BrandedInvite.isVsCode("ANT5TTZR"))
        XCTAssertFalse(BrandedInvite.isVsCode("ANT5TTZ"))
        XCTAssertFalse(BrandedInvite.isVsCode("ANT5TT0R"))
        XCTAssertEqual(BrandedInvite.url(.vs, "ant5ttzr"), "https://wordocious.com/vs/ANT5TTZR")
        XCTAssertEqual(BrandedInvite.url(.friend, "abc234"), "https://wordocious.com/friend/ABC234")
    }

    func testParsesNewAndOldForms() {
        XCTAssertEqual(BrandedInvite.parse("https://wordocious.com/vs/ANT5TTZR"), .init(kind: .vs, code: "ANT5TTZR"))
        XCTAssertEqual(BrandedInvite.parse("https://www.wordocious.com/vs/join/ant5ttzr?x=1"), .init(kind: .vs, code: "ANT5TTZR"))
        XCTAssertEqual(BrandedInvite.parse("/vs/challenge/ANT5TTZR/"), .init(kind: .vs, code: "ANT5TTZR"))
        XCTAssertEqual(BrandedInvite.parse("https://wordocious.com/friend/ABC234"), .init(kind: .friend, code: "ABC234"))
        XCTAssertEqual(BrandedInvite.parse("https://wordocious.com/join/ABC234"), .init(kind: .friend, code: "ABC234"))
    }

    func testStaticVsPagesAreNeverCodes() {
        for p in ["/vs/bots", "/vs/live", "/vs/friend", "/vs/join", "/vs/challenge"] { XCTAssertNil(BrandedInvite.parse(p)) }
        XCTAssertNil(BrandedInvite.parse("https://example.com/vs/ANT5TTZR"))
        XCTAssertFalse(BrandedInvite.isBrandedVsCode("bots"))
        XCTAssertTrue(BrandedInvite.isBrandedVsCode("ant5ttzr"))
    }

    func testHaveACode() {
        XCTAssertEqual(BrandedInvite.parseTyped("ant5 ttzr"), .init(kind: .vs, code: "ANT5TTZR"))
        XCTAssertEqual(BrandedInvite.parseTyped("https://wordocious.com/vs/ANT5TTZR"), .init(kind: .vs, code: "ANT5TTZR"))
        XCTAssertNil(BrandedInvite.parseTyped("hello"))
        XCTAssertEqual(BrandedInvite.shareLine(.live, sender: "Johnny", game: "Classic"), "Johnny wants to race you in Classic")
    }
}
