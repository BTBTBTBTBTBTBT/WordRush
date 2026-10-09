import XCTest
@testable import WordociousCore

/// Wave 3 parity guard (iOS side): FriendCards must lay out the Friends tab, word
/// the tiles and the headlines exactly like packages/core/src/friend-cards.ts.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class FriendCardsFixtureTests: XCTestCase {
    private struct TileCase: Decodable {
        let kind: FriendlyKind
        let state: FriendlyState
        let me: FriendlySide
        let yourTurn: Bool
        let word: String
    }
    private struct LayoutCase: Decodable {
        let name: String
        let friends: [CardFriend]
        let games: [CardGame]
        let layout: FriendsLayout
    }
    private struct CountText: Decodable { let n: Int; let text: String }
    private struct NameText: Decodable { let n: Int; let name: String; let text: String }
    private struct PresenceCase: Decodable { let online: Bool; let activity: String?; let text: String? }
    private struct Words: Decodable {
        let waiting: [CountText]
        let theirTurn: [NameText]
        let presence: [PresenceCase]
        let all: [CountText]
    }
    private struct Fixtures: Decodable {
        let tiles: [TileCase]
        let layouts: [LayoutCase]
        let words: Words
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "friend-cards-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testTileWordsMatchCore() throws {
        let f = try load()
        XCTAssertFalse(f.tiles.isEmpty)
        for (i, t) in f.tiles.enumerated() {
            XCTAssertEqual(FriendCards.tileWord(kind: t.kind, state: t.state, me: t.me, yourTurn: t.yourTurn), t.word, "tile #\(i) \(t.kind.rawValue)")
        }
    }

    func testLayoutsMatchCore() throws {
        let f = try load()
        XCTAssertFalse(f.layouts.isEmpty)
        for c in f.layouts {
            XCTAssertEqual(FriendCards.friendsLayout(friends: c.friends, games: c.games), c.layout, c.name)
        }
    }

    func testWordsMatchCore() throws {
        let w = try load().words
        for c in w.waiting { XCTAssertEqual(FriendCards.waitingHeadline(c.n), c.text) }
        for c in w.theirTurn { XCTAssertEqual(FriendCards.theirTurnLine(c.n, name: c.name), c.text) }
        for c in w.presence { XCTAssertEqual(FriendCards.cardPresence(online: c.online, activity: c.activity), c.text) }
        for c in w.all { XCTAssertEqual(FriendCards.allFriendsLabel(c.n), c.text) }
    }
}
