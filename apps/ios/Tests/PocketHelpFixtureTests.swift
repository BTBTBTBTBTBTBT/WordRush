import XCTest
@testable import WordociousCore

/// Wave 3 parity guard (iOS side): PocketHelp must carry the same How to Play
/// words, art names and first-play decisions as packages/core/src/pocket-help.ts.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class PocketHelpFixtureTests: XCTestCase {
    private struct Decision: Decodable { let live: Bool; let seen: [String]; let key: String; let show: Bool }
    private struct Seen: Decodable { let seen: [String]; let key: String; let result: [String] }
    private struct Merge: Decodable { let a: [String]; let b: [String]; let result: [String] }
    private struct Fixtures: Decodable {
        let flag: String
        let help: [String: PocketHelpCard]
        let keys: [String]
        let decisions: [Decision]
        let seen: [Seen]
        let merged: [Merge]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "pocket-help-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testHelpCardsMatchCore() throws {
        let f = try load()
        XCTAssertEqual(f.flag, PocketHelp.firstPlayFlag)
        XCTAssertEqual(Set(f.help.keys), Set(FriendlyKind.allCases.map(\.rawValue)))
        for kind in FriendlyKind.allCases {
            XCTAssertEqual(PocketHelp.help[kind], f.help[kind.rawValue], kind.rawValue)
            XCTAssertEqual(PocketHelp.help[kind]?.steps.count, 3, kind.rawValue)
        }
        XCTAssertEqual(FriendlyKind.allCases.map(PocketHelp.tutorialKey), f.keys)
    }

    func testFirstPlayDecisionsMatchCore() throws {
        for d in try load().decisions {
            XCTAssertEqual(PocketHelp.shouldAutoShowTutorial(live: d.live, seen: d.seen, key: d.key), d.show, "\(d.key) live=\(d.live) seen=\(d.seen)")
        }
        // Still loading: never show on a guess.
        XCTAssertFalse(PocketHelp.shouldAutoShowTutorial(live: true, seen: nil, key: "hub"))
    }

    func testSeenListsMatchCore() throws {
        let f = try load()
        for s in f.seen { XCTAssertEqual(PocketHelp.withTutorialSeen(s.seen, key: s.key), s.result) }
        for m in f.merged { XCTAssertEqual(PocketHelp.mergeTutorialsSeen(m.a, m.b), m.result) }
    }
}
