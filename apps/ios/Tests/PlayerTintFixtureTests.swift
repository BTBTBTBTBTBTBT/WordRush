import XCTest
@testable import WordociousCore

/// Parity guard (iOS side): a player's own colors must match packages/core/src/player-tint.ts.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class PlayerTintFixtureTests: XCTestCase {
    private struct Plate: Decodable { let fill: [String]; let border: [String]; let borderWidth: Double; let lightInk: Bool }
    private struct Case: Decodable { let bg: String; let frame: String; let color: String; let bodyHex: String; let plate: Plate; let nameHex: String }
    private struct Fixtures: Decodable { let cases: [Case] }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "player-tint-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testPlatesAndNamesMatchCore() throws {
        let f = try load()
        XCTAssertGreaterThanOrEqual(f.cases.count, 12)
        for c in f.cases {
            let label = "\(c.bg)/\(c.frame)/\(c.color)"
            XCTAssertEqual(AvatarCatalog.colorHex(c.color), c.bodyHex, label)
            let got = PlayerTintCore.plateHexes(bg: c.bg, frame: c.frame, bodyHex: c.bodyHex)
            XCTAssertEqual(got.fill, c.plate.fill, label)
            XCTAssertEqual(got.border, c.plate.border, label)
            XCTAssertEqual(got.borderWidth, c.plate.borderWidth, accuracy: 1e-9, label)
            XCTAssertEqual(got.lightInk, c.plate.lightInk, label)
            XCTAssertEqual(PlayerTintCore.nameHex(bg: c.bg, bodyHex: c.bodyHex), c.nameHex, label)
        }
    }
}
