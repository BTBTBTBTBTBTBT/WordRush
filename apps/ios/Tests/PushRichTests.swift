import XCTest
@testable import WordociousCore

final class PushRichTests: XCTestCase {
    private let full: [AnyHashable: Any] = [
        "aps": ["alert": ["title": "Ava played Hubbub", "body": "Your turn"]],
        "url": "/friends/games/g1",
        "rich": [
            "senderId": "u1", "senderName": "Ava", "senderAvatar": "https://wordocious.com/api/push/art/avatar/u1",
            "gameId": "hub", "gameTitle": "Hubbub", "gameImage": "https://wordocious.com/api/push/art/game/hub",
            "thread": "game:g1", "accent": "#c026d3", "halloween": "0", "score": "2-1", "url": "/friends/games/g1",
        ] as [String: Any],
    ]

    func testParsesAFullRichPush() throws {
        let r = try XCTUnwrap(PushRich.parse(userInfo: full))
        XCTAssertEqual(r.senderName, "Ava")
        XCTAssertEqual(r.senderAvatar?.absoluteString, "https://wordocious.com/api/push/art/avatar/u1")
        XCTAssertEqual(r.gameImage?.lastPathComponent, "hub")
        XCTAssertEqual(r.thread, "game:g1")
        XCTAssertEqual(r.accent, "#c026d3")
        XCTAssertFalse(r.halloween)
        XCTAssertEqual(r.score, "2-1")
        XCTAssertEqual(r.url, "/friends/games/g1")
    }

    func testPlainPushIsNotRich() {
        XCTAssertNil(PushRich.parse(userInfo: ["aps": ["alert": "hi"], "url": "/daily"]))
    }

    func testRefusesNonHttpsImagesAndDefaultsTheAccent() throws {
        var rich = full["rich"] as! [String: Any]
        rich["senderAvatar"] = "http://evil.example/a.png"
        rich["accent"] = ""
        rich["halloween"] = "1"
        let r = try XCTUnwrap(PushRich.parse(userInfo: ["rich": rich]))
        XCTAssertNil(r.senderAvatar)
        XCTAssertEqual(r.accent, "#7c3aed")
        XCTAssertTrue(r.halloween)
    }

    func testNeedsASenderName() {
        XCTAssertNil(PushRich.parse(userInfo: ["rich": ["senderName": " ", "gameId": "hub"]]))
    }
}
