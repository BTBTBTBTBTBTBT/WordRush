import XCTest
@testable import WordociousCore

/// FINISH_SPEC §S4 parity guard: ShareCaptions must pick and fill exactly like
/// packages/core/src/share-captions.ts for every fixture case.
final class ShareCopyTests: XCTestCase {
    private struct HashCase: Decodable { let key: String; let hash: UInt32 }
    private struct Pick: Decodable { let kind: ShareCaptions.Kind; let date: String; let game: String; let index: Int }
    private struct Filled: Decodable {
        let kind: ShareCaptions.Kind
        let date: String
        let game: String
        let n: Int?
        let t: String?
        let b: Int?
        let k: Int?
        let opp: String?
        let url: String?
        let d: Int?
        let text: String
    }
    private struct Fixtures: Decodable {
        let bank: [String: [String]]
        let toasts: [String: String]
        let hashes: [HashCase]
        let picks: [Pick]
        let filled: [Filled]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "share-captions-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testBankAndToastsMatch() throws {
        let f = try load()
        XCTAssertEqual(f.bank.count, ShareCaptions.Kind.allCases.count)
        for kind in ShareCaptions.Kind.allCases {
            XCTAssertEqual(ShareCaptions.bank[kind], f.bank[kind.rawValue], kind.rawValue)
        }
        XCTAssertEqual(f.toasts["copied"], ShareCaptions.copiedToast)
        XCTAssertEqual(f.toasts["saved"], ShareCaptions.savedToast)
    }

    func testHashMatches() throws {
        let f = try load()
        XCTAssertEqual(ShareCaptions.hash("a"), 0xE40C292C)
        XCTAssertEqual(ShareCaptions.hash("foobar"), 0xBF9CF968)
        for c in f.hashes { XCTAssertEqual(ShareCaptions.hash(c.key), c.hash, c.key) }
    }

    func testPicksMatch() throws {
        let f = try load()
        XCTAssertFalse(f.picks.isEmpty)
        for (i, c) in f.picks.enumerated() {
            XCTAssertEqual(ShareCaptions.index(c.kind, date: c.date, game: c.game), c.index, "pick #\(i)")
        }
    }

    func testFilledMatch() throws {
        let f = try load()
        XCTAssertFalse(f.filled.isEmpty)
        for (i, c) in f.filled.enumerated() {
            let v = ShareCaptions.Vars(date: c.date, game: c.game, n: c.n.map(String.init), t: c.t, b: c.b.map(String.init),
                                       d: c.d, k: c.k.map(String.init), opp: c.opp, url: c.url)
            XCTAssertEqual(ShareCaptions.caption(c.kind, v), c.text, "filled #\(i)")
        }
    }

    func testConveniences() {
        XCTAssertEqual(ShareCopy.caption(.multiWin(boards: 4, guesses: 9), game: "QuadWord", date: "2026-10-02"),
                       "All 4 QuadWord boards cleared in 9 guesses 🧠✨")
        XCTAssertEqual(ShareCopy.caption(.sweep, game: "Sweep", date: "2026-10-02", streak: 12),
                       "Swept every Wordocious daily today 🧹✨ 🔥 Day 12")
        XCTAssertEqual(ShareCopy.caption(.vsDraw(opponent: "Doug"), game: "Classic", date: "2026-10-02"),
                       "Doug and I tied at Classic. Rematch? ⚔️")
        XCTAssertEqual(ShareCopy.vsInvite(game: "Classic", url: "u"), "Race me at Classic! ⚡ u")
        XCTAssertEqual(ShareCopy.invite(url: "u"), "Come play Wordocious with me! 🎉 u")
    }
}
