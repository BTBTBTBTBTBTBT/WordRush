import XCTest
@testable import WordociousCore

/// Wave 3 parity guard (iOS side): WaitingRoom must say the same status lines,
/// clocks, keepy-uppy lines and idle bits as packages/core/src/waiting-room.ts.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class WaitingRoomFixtureTests: XCTestCase {
    private struct Line: Decodable { let kind: WaitingKind; let name: String?; let text: String }
    private struct Clock: Decodable { let seconds: Double?; let text: String }
    private struct Waited: Decodable { let startMs: Double; let nowMs: Double; let seconds: Int }
    private struct Keepy: Decodable { let count: Int; let best: Int; let text: String }
    private struct Idle: Decodable { let seconds: Int; let bit: String? }
    private struct Fixtures: Decodable {
        let lines: [Line]
        let clocks: [Clock]
        let waited: [Waited]
        let keepy: [Keepy]
        let idle: [Idle]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "waiting-room-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testWaitingWordsMatchCore() throws {
        let f = try load()
        for l in f.lines { XCTAssertEqual(WaitingRoom.statusLine(kind: l.kind, name: l.name), l.text, "\(l.kind.rawValue) \(l.name ?? "nil")") }
        // A null seconds (NaN in core) reads 0:00.
        for c in f.clocks { XCTAssertEqual(WaitingRoom.waitClock(c.seconds ?? .nan), c.text, "\(String(describing: c.seconds))") }
        for w in f.waited { XCTAssertEqual(WaitingRoom.waitedSeconds(startMs: w.startMs, nowMs: w.nowMs), w.seconds) }
        for k in f.keepy { XCTAssertEqual(WaitingRoom.keepyLine(count: k.count, best: k.best), k.text) }
        for i in f.idle { XCTAssertEqual(WaitingRoom.idleBit(i.seconds), i.bit, "\(i.seconds)") }
    }
}
