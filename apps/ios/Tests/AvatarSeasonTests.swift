import XCTest
@testable import WordociousCore

/// Parity: packages/core avatar-season.ts (avatar-season-fixtures.json) against the app's bundled avatar-parts.json.
final class AvatarSeasonTests: XCTestCase {
    private static let app = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Wordocious/Resources")

    struct Avail: Decodable { let part: AvatarPart; let date: String; let preview: String?; let saved: [String: String]?; let available: Bool }
    struct Active: Decodable { let date: String; let preview: String?; let season: String? }
    struct Wears: Decodable { let config: [String: String]?; let season: String?; let wears: Bool }
    struct Nudge: Decodable { let date: String; let preview: String?; let config: [String: String]?; let seen: [String]; let due: String? }
    struct Key: Decodable { let season: String; let date: String; let key: String; let tag: String }
    struct Seasons: Decodable { let field: String; let id: String; let season: String? }
    struct F: Decodable {
        let available: [Avail]; let seasons: [Seasons]; let active: [Active]; let shelf: [String: [AvatarPart]]
        let wears: [Wears]; let nudge: [Nudge]; let keys: [Key]
    }

    func testMatchesSharedFixture() throws {
        let m = try AvatarManifest.decode(Data(contentsOf: Self.app.appendingPathComponent("avatar-parts.json")))
        let url = try XCTUnwrap(Bundle.module.url(forResource: "avatar-season-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "avatar-season-fixtures", withExtension: "json"))
        let f = try JSONDecoder().decode(F.self, from: Data(contentsOf: url))
        for c in f.available {
            XCTAssertEqual(AvatarSeason.isPartAvailable(c.part, day: c.date, preview: c.preview, saved: c.saved, manifest: m), c.available,
                           "\(c.part) \(c.date) \(c.preview ?? "-") \(String(describing: c.saved))")
        }
        for c in f.seasons { XCTAssertEqual(AvatarSeason.partSeason(field: c.field, id: c.id, manifest: m), c.season, c.id) }
        for c in f.active { XCTAssertEqual(AvatarSeason.active(day: c.date, preview: c.preview), c.season) }
        XCTAssertEqual(AvatarSeason.shelf("halloween", manifest: m), f.shelf["halloween"])
        XCTAssertEqual(AvatarSeason.shelf(nil, manifest: m), [])
        XCTAssertEqual(AvatarSeason.shelf("arbor-day", manifest: m), f.shelf["unknown"])
        for c in f.wears { XCTAssertEqual(AvatarSeason.wearsSeasonalPart(c.config, season: c.season, manifest: m), c.wears) }
        for c in f.nudge {
            XCTAssertEqual(AvatarSeason.nudgeDue(day: c.date, preview: c.preview, config: c.config, seen: c.seen, manifest: m), c.due,
                           "\(c.date) \(c.preview ?? "-") \(c.seen)")
        }
        for c in f.keys {
            XCTAssertEqual(AvatarSeason.nudgeKey(c.season, day: c.date), c.key)
            XCTAssertEqual(AvatarSeason.tag(c.season), c.tag)
        }
    }

    func testSeasonalArtShips() {
        for p in ["art-dress-tag-halloween", "art-av-acc-pumpkinhat", "art-av-acc-candypail", "art-av-acc-ghost-classic-pet"] {
            XCTAssertTrue(FileManager.default.fileExists(atPath: Self.app.appendingPathComponent("Assets.xcassets/\(p).imageset/\(p).png").path), p)
        }
    }
}
