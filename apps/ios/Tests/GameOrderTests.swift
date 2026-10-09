import XCTest
@testable import WordociousCore

/// Item 35: parity with packages/core/src/game-order.test.ts.
final class GameOrderTests: XCTestCase {
    private let d = GameOrder.defaultDailies

    func testFounderDefault() {
        XCTAssertEqual(d, ["practice", "quordle", "octordle", "sequence", "six", "seven", "rescue", "gauntlet"])
        XCTAssertEqual(GameOrder.defaultPuzzles.last, "scramble")
    }

    func testNoSavedOrderIsDefault() {
        XCTAssertEqual(GameOrder.apply(defaultIds: d, saved: nil, pinnedFirst: "practice"), d)
        XCTAssertEqual(GameOrder.apply(defaultIds: d, saved: [], pinnedFirst: "practice"), d)
    }

    func testClassicStaysFirst() {
        let out = GameOrder.apply(defaultIds: d, saved: ["gauntlet", "practice", "six"], pinnedFirst: "practice")
        XCTAssertEqual(Array(out.prefix(3)), ["practice", "gauntlet", "six"])
    }

    func testUnknownDroppedDuplicatesCollapsedNewAppended() {
        let out = GameOrder.apply(defaultIds: d, saved: ["seven", "ghost", "seven", "six"], pinnedFirst: "practice")
        XCTAssertEqual(out, ["practice", "seven", "six", "quordle", "octordle", "sequence", "rescue", "gauntlet"])
    }

    func testPuzzlesHaveNoPin() {
        XCTAssertEqual(GameOrder.apply(defaultIds: GameOrder.defaultPuzzles, saved: ["scramble"], pinnedFirst: nil).first, "scramble")
    }

    func testMoveCannotMoveOrDisplacePinned() {
        XCTAssertEqual(GameOrder.move(d, from: 0, to: 3, pinnedFirst: "practice"), d)
        XCTAssertEqual(GameOrder.move(d, from: 3, to: 0, pinnedFirst: "practice").first, "practice")
        XCTAssertEqual(GameOrder.move(d, from: 7, to: 1, pinnedFirst: "practice"),
                       ["practice", "gauntlet", "quordle", "octordle", "sequence", "six", "seven", "rescue"])
        XCTAssertEqual(GameOrder.move(d, from: 2, to: 2, pinnedFirst: "practice"), d)
        XCTAssertEqual(GameOrder.move(d, from: 2, to: 99, pinnedFirst: "practice"), d)
    }

    func testIsDefault() {
        XCTAssertTrue(GameOrder.isDefault(defaultIds: d, saved: d, pinnedFirst: "practice"))
        XCTAssertFalse(GameOrder.isDefault(defaultIds: d, saved: ["practice", "six"], pinnedFirst: "practice"))
        XCTAssertTrue(GameOrder.isDefault(defaultIds: d, saved: nil, pinnedFirst: "practice"))
    }

    func testNextUnplayedWalksYourOrder() {
        let order = ["practice", "six", "seven", "quordle"]
        XCTAssertEqual(GameOrder.nextUnplayed(order: order, currentId: "practice", played: ["practice"]), "six")
        XCTAssertEqual(GameOrder.nextUnplayed(order: order, currentId: "six", played: ["practice", "six", "seven"]), "quordle")
        XCTAssertEqual(GameOrder.nextUnplayed(order: order, currentId: "quordle", played: ["quordle", "six"]), "practice")
        XCTAssertNil(GameOrder.nextUnplayed(order: order, currentId: "quordle", played: Set(order)))
        XCTAssertEqual(GameOrder.nextUnplayed(order: order, currentId: "unknown", played: []), "practice")
    }

    func testParse() {
        XCTAssertNil(GameOrder.parse(dailies: nil, puzzles: nil))
        XCTAssertEqual(GameOrder.parse(dailies: ["six"], puzzles: []), GameOrderPrefs(dailies: ["six"], puzzles: []))
    }

    /// The generated catalog (modes.json homeSlot) must equal the defaults here.
    func testCatalogMatchesDefaults() throws {
        let src = try String(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Wordocious/Sources/ModeCatalog.generated.swift"))
        func slot(_ id: String) -> Int {
            let line = src.split(separator: "\n").first { $0.contains("GenMode(id: \"\(id)\"") }.map(String.init) ?? ""
            let r = line.range(of: "homeSlot: ")!
            return Int(line[r.upperBound...].prefix { $0.isNumber })!
        }
        XCTAssertEqual(GameOrder.defaultDailies.sorted { slot($0) < slot($1) }, GameOrder.defaultDailies)
        XCTAssertEqual(GameOrder.defaultPuzzles.sorted { slot($0) < slot($1) }, GameOrder.defaultPuzzles)
    }
}
