import XCTest
@testable import WordociousCore

/// 2.8 item 40: the screen-reader labels match packages/core/src/a11y-labels.ts (shared fixture) and are never empty.
final class A11yLabelsTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Place: Decodable { let place: Int; let word: String; let open: String }
        struct Podium: Decodable { let place: Int; let name: String; let points: String; let detail: String?; let label: String; let card: String }
        struct Seal: Decodable { let days: Int; let label: String }
        struct Head: Decodable { let lines: [String]; let label: String }
        struct Mascot: Decodable { let own: Bool; let name: String?; let label: String }
        struct Progress: Decodable { let played: Int; let total: Int; let label: String }
        let places: [Place]
        let podium: [Podium]
        let seals: [Seal]
        let headlines: [Head]
        let mascots: [Mascot]
        let progress: [Progress]
    }

    private func load() throws -> Fixture {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "a11y-labels-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testMatchesTheSharedFixture() throws {
        let f = try load()
        for c in f.places {
            XCTAssertEqual(A11yLabels.placeWord(c.place), c.word)
            XCTAssertEqual(A11yLabels.podiumOpenSpot(c.place), c.open)
        }
        for c in f.podium {
            XCTAssertEqual(A11yLabels.podiumPlace(c.place, name: c.name, points: c.points, detail: c.detail), c.label)
            XCTAssertEqual(A11yLabels.podiumStageCard(name: c.name, place: c.place), c.card)
        }
        for c in f.seals { XCTAssertEqual(A11yLabels.flawlessSeal(days: c.days), c.label) }
        for c in f.headlines { XCTAssertEqual(A11yLabels.headline(c.lines), c.label) }
        for c in f.mascots { XCTAssertEqual(A11yLabels.mascot(own: c.own, name: c.name), c.label) }
        for c in f.progress { XCTAssertEqual(A11yLabels.progress(played: c.played, total: c.total), c.label) }
    }

    func testNeverEmpty() {
        let all = [
            A11yLabels.placeWord(0), A11yLabels.podiumOpenSpot(9), A11yLabels.podiumPlace(1, name: "", points: "", detail: nil),
            A11yLabels.podiumStageCard(name: "", place: 3), A11yLabels.flawlessSeal(days: 0), A11yLabels.headline([]),
            A11yLabels.headline(["", " "]), A11yLabels.mascot(own: false, name: nil), A11yLabels.mascot(own: false, name: " "),
            A11yLabels.progress(played: 0, total: 0),
        ]
        for l in all { XCTAssertFalse(l.trimmingCharacters(in: .whitespaces).isEmpty) }
    }
}
