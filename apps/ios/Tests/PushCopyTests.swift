import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AE parity guard: PushCopy matches packages/core push-copy.ts.
final class PushCopyTests: XCTestCase {
    private struct Filled: Decodable {
        let kind: PushCopy.Kind
        let name: String?
        let game: String?
        let days: Int?
        let text: String
    }
    private struct Fixtures: Decodable {
        let title: String
        let bank: [String: String]
        let filled: [Filled]
    }

    func testMatchesSharedFixtures() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "push-copy-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        let f = try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
        XCTAssertEqual(f.title, PushCopy.title)
        XCTAssertEqual(f.bank.count, PushCopy.Kind.allCases.count)
        for k in PushCopy.Kind.allCases { XCTAssertEqual(PushCopy.bank[k], f.bank[k.rawValue], k.rawValue) }
        XCTAssertFalse(f.filled.isEmpty)
        for (i, c) in f.filled.enumerated() {
            XCTAssertEqual(PushCopy.body(c.kind, name: c.name, game: c.game, days: c.days), c.text, "filled #\(i)")
        }
    }
}
