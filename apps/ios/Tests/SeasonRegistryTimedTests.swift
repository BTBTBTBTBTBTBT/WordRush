import XCTest
@testable import WordociousCore

/// 10-16 time of day: the real registry (Wordocious/Resources/season-registry.json, the copy SeasonKit reads) must decode with
/// `slots.walls` values and `slots.stage` as EITHER a plain string OR {night, morning, day, evening}, one bad season entry
/// must not empty the registry, and halloween + thanksgiving must resolve a night wall + stage. SeasonKit lives in the app
/// target, so the same tolerant shapes (SeasonKit.TimedName / File's lossy seasons) are mirrored here.
final class SeasonRegistryTimedTests: XCTestCase {
    private static let registryURL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("Wordocious/Resources/season-registry.json")

    private struct Timed: Decodable {
        let night: String
        let byTime: [String: String]
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let one = try? c.decode(String.self) { night = one; byTime = [:]; return }
            let m = try c.decode([String: String].self)
            guard let n = m["night"] else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "no night") }
            night = n; byTime = m
        }
    }
    private struct Slots: Decodable { let walls: [String: Timed]?; let stage: Timed? }
    private struct Entry: Decodable { let id: String; let slots: Slots }
    private struct File: Decodable {
        let seasons: [Entry]
        private struct Lossy: Decodable { let e: Entry?; init(from d: Decoder) throws { e = try? Entry(from: d) } }
        init(from d: Decoder) throws {
            seasons = try d.container(keyedBy: K.self).decode([Lossy].self, forKey: .seasons).compactMap(\.e)
        }
        enum K: String, CodingKey { case seasons }
    }

    func testRealRegistryDecodesWithTimedWallsAndStage() throws {
        let file = try JSONDecoder().decode(File.self, from: Data(contentsOf: Self.registryURL))
        for id in ["halloween", "thanksgiving"] {
            let e = try XCTUnwrap(file.seasons.first { $0.id == id }, "\(id) missing")
            XCTAssertFalse(try XCTUnwrap(e.slots.stage).night.isEmpty)
            let walls = try XCTUnwrap(e.slots.walls)
            XCTAssertFalse(walls.isEmpty)
            XCTAssertFalse(try XCTUnwrap(walls["art-wall-home"]).night.isEmpty)
        }
    }

    func testStringOrObjectAndOneBadEntry() throws {
        let json = #"{"seasons":[{"id":"a","slots":{"walls":{"w":"plain"},"stage":{"night":"n","day":"d"}}},{"id":"bad","slots":{"walls":{"w":{"day":"x"}}}},{"id":"c","slots":{"stage":"s"}}]}"#
        let file = try JSONDecoder().decode(File.self, from: Data(json.utf8))
        XCTAssertEqual(file.seasons.map(\.id), ["a", "c"])
        XCTAssertEqual(file.seasons[0].slots.walls?["w"]?.night, "plain")
        XCTAssertEqual(file.seasons[0].slots.stage?.byTime["day"], "d")
        XCTAssertEqual(file.seasons[1].slots.stage?.night, "s")
    }
}
