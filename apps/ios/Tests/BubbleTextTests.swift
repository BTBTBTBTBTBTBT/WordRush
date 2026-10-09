import XCTest
@testable import WordociousCore

/// 2.8 item 6: the bubble-text fit — parity with packages/core/src/bubble-text.ts via the shared fixture,
/// plus the no-clip guard (every line fits its slot, no ellipsis, nothing dropped).
final class BubbleTextTests: XCTestCase {
    private struct FitJSON: Decodable {
        let lines: [String]
        let size: Double
        let wrapped: Bool
        let nameLines: [Int]?
    }
    private struct Fixture: Decodable {
        struct Width: Decodable { let text: String; let em: Double }
        struct Fit: Decodable { let text: String; let slot: Double; let maxSize: Double; let minSize: Double; let fit: FitJSON }
        struct Home: Decodable { let text: String; let name: String; let slot: Double; let fit: FitJSON }
        struct Glyph: Decodable { let ch: String; let name: String? }
        let widths: [Width]
        let fits: [Fit]
        let home: [Home]
        let glyphs: [Glyph]
        struct PlaceJSON: Decodable { let stem: String; let ci: Int; let x: Double; let y: Double }
        struct LayoutJSON: Decodable { let places: [PlaceJSON]; let width: Double }
        struct LayoutCase: Decodable { let text: String; let layout: LayoutJSON }
        let layouts: [LayoutCase]
    }

    private func load() throws -> Fixture {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "bubble-text-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testFixtureParity() throws {
        let fx = try load()
        XCTAssertFalse(fx.fits.isEmpty)
        for w in fx.widths { XCTAssertEqual(BubbleText.widthEm(w.text), w.em, accuracy: 1e-9, w.text) }
        for f in fx.fits {
            let got = BubbleText.fit(f.text, slotWidth: f.slot, maxSize: f.maxSize, minSize: f.minSize)
            XCTAssertEqual(got.lines, f.fit.lines, "\(f.text) @\(f.slot) lines")
            XCTAssertEqual(got.size, f.fit.size, "\(f.text) @\(f.slot) size")
            XCTAssertEqual(got.wrapped, f.fit.wrapped, "\(f.text) @\(f.slot) wrapped")
        }
        for h in fx.home {
            let got = BubbleText.homeFit(h.text, name: h.name, slotWidth: h.slot)
            XCTAssertEqual(got.lines, h.fit.lines, "\(h.text) @\(h.slot) lines")
            XCTAssertEqual(got.size, h.fit.size, "\(h.text) @\(h.slot) size")
            XCTAssertEqual(got.nameLines, h.fit.nameLines ?? [], "\(h.text) @\(h.slot) nameLines")
        }
        for c in fx.layouts {
            let got = BubbleText.atlasLayout(c.text)
            XCTAssertEqual(got.width, c.layout.width, accuracy: 1e-9, c.text)
            XCTAssertEqual(got.places.map(\.stem), c.layout.places.map(\.stem), c.text)
            XCTAssertEqual(got.places.map(\.ci), c.layout.places.map(\.ci), c.text)
            for (a, b) in zip(got.places, c.layout.places) {
                XCTAssertEqual(a.x, b.x, accuracy: 1e-9, c.text)
                XCTAssertEqual(a.y, b.y, accuracy: 1e-9, c.text)
            }
        }
        for g in fx.glyphs { XCTAssertEqual(BubbleText.glyphName(Character(g.ch)), g.name, g.ch) }
    }

    /// The no-clip guard: the longest headlines at the narrowest to the widest slots.
    func testNeverClipsOrTruncates() {
        let texts = [
            "WORDOCIOUS FLAWLESS! 10 PUZZLES LEFT", "PUZZLES SWEPT! 10 PUZZLES LEFT", "ON A ROLL \u{00B7} 11 OF 18",
            "GOOD AFTERNOON, MAXIMILLIAN_THE_GREAT!", "SPOOKY SEASON \u{00B7} TRICK OR TREAT \u{2605} 9,999 POINTS", "SATURDAY SUPERSTARS",
        ]
        for slot in [220.0, 285, 334, 400, 520, 760] {
            for t in texts {
                let f = BubbleText.fit(t, slotWidth: slot, maxSize: 38)
                XCTAssertEqual(f.lines.joined().replacingOccurrences(of: " ", with: ""), t.replacingOccurrences(of: " ", with: ""))
                for l in f.lines {
                    XCTAssertFalse(l.contains("\u{2026}"))
                    XCTAssertLessThanOrEqual(BubbleText.widthEm(l) * f.size, slot + 1e-6, "\(t) @\(slot)")
                }
            }
        }
    }
}
