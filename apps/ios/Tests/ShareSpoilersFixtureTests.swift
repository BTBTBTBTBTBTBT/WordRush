import XCTest
@testable import WordociousCore

/// Share-card spoiler parity guard (iOS side): every puzzle game's `clean` / `full` share model must come out
/// byte-equal to packages/core/src/share-spoilers.ts, and a clean model must never carry the answer.
/// Fixtures/share-spoilers-fixtures.json; regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class ShareSpoilersFixtureTests: XCTestCase {
    private func fixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "share-spoilers-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    /// Canonical JSON (sorted keys, compact) through one serializer, so a model and a fixture object compare byte for byte.
    private func canonical(_ object: Any) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), as: UTF8.self)
    }
    private func canonical<M: Encodable>(_ model: M) throws -> String {
        try canonical(try JSONSerialization.jsonObject(with: JSONEncoder().encode(model)))
    }
    private func decode<T: Decodable>(_ type: T.Type, _ object: Any) throws -> T {
        try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: object))
    }

    /// Runs one game's fixture list: both variants byte-equal, and the clean JSON free of every answer string.
    private func check<I: Decodable, M: Encodable>(_ name: String, _ input: I.Type, answers: ([String: Any]) -> [String],
                                                  make: (I, ShareVariant, [String: Any]) -> M, file: StaticString = #filePath, line: UInt = #line) throws {
        let cases = try XCTUnwrap(try fixture()[name] as? [[String: Any]])
        XCTAssertFalse(cases.isEmpty, name, file: file, line: line)
        for (i, c) in cases.enumerated() {
            let raw = try XCTUnwrap(c["input"] as? [String: Any])
            let input = try decode(I.self, raw)
            for variant in ShareVariant.allCases {
                let want = try canonical(try XCTUnwrap(c[variant.rawValue]))
                let got = try canonical(make(input, variant, raw))
                XCTAssertEqual(got, want, "\(name) #\(i) \(variant.rawValue)", file: file, line: line)
            }
            let clean = try canonical(make(input, .clean, raw))
            for a in answers(raw) where !a.isEmpty {
                XCTAssertFalse(clean.contains(a), "\(name) #\(i) clean leaks \(a)", file: file, line: line)
            }
        }
    }

    func testVariantCopyMatchesFixture() throws {
        let f = try fixture()
        XCTAssertEqual(try XCTUnwrap(f["variants"] as? [String]), ShareVariant.allCases.map(\.rawValue))
        let subtitles = try XCTUnwrap(f["subtitles"] as? [String: [String]])
        XCTAssertEqual(Set(subtitles.keys), Set(ShareSpoilers.subtitles.keys))
        for (mode, pair) in subtitles {
            XCTAssertEqual(ShareSpoilers.subtitles[mode]?.clean, pair[0], mode)
            XCTAssertEqual(ShareSpoilers.subtitles[mode]?.full, pair[1], mode)
        }
        let defaults = try XCTUnwrap(f["defaultSubtitles"] as? [String])
        XCTAssertEqual(defaults, [ShareSpoilers.defaultSubtitles.clean, ShareSpoilers.defaultSubtitles.full])
        let copy = try XCTUnwrap(f["copy"] as? [[String: Any]])
        XCTAssertFalse(copy.isEmpty)
        for c in copy {
            let mode = try XCTUnwrap(c["mode"] as? String)
            let got = ShareSpoilers.variantCopy(mode)
            let clean = try XCTUnwrap(c["clean"] as? [String: String]), full = try XCTUnwrap(c["full"] as? [String: String])
            XCTAssertEqual(got.clean.title, clean["title"], mode); XCTAssertEqual(got.clean.subtitle, clean["subtitle"], mode)
            XCTAssertEqual(got.full.title, full["title"], mode); XCTAssertEqual(got.full.subtitle, full["subtitle"], mode)
        }
    }

    func testStarsweep() throws {
        try check("starsweep", StarsweepShareInput.self, answers: { [$0["board"] as? String ?? ""] }) { g, v, _ in starsweepShareModel(g, v) }
    }

    func testSudocious() throws {
        try check("sudocious", SudociousShareInput.self, answers: { [$0["solution"] as? String ?? ""] }) { g, v, _ in sudociousShareModel(g, v) }
    }

    func testCrossword() throws {
        try check("crossword", CrosswordShareInput.self, answers: { [$0["solution"] as? String ?? "", $0["fill"] as? String ?? ""] }) { g, v, _ in crosswordShareModel(g, v) }
    }

    func testKindred() throws {
        try check("kindred", KindredShareInput.self, answers: { raw in
            (raw["groups"] as? [[String: Any]] ?? []).flatMap { ($0["words"] as? [String] ?? []) + [$0["label"] as? String ?? ""] }
        }) { g, v, _ in kindredShareModel(g, v) }
    }

    func testSpyglass() throws {
        try check("spyglass", SpyglassShareInput.self, answers: { raw in
            [raw["grid"] as? String ?? ""] + (raw["words"] as? [[String: Any]] ?? []).compactMap { $0["w"] as? String }
        }) { g, v, _ in spyglassShareModel(g, v) }
    }

    func testHubbub() throws {
        try check("hubbub", HubbubShareInput.self, answers: { $0["found"] as? [String] ?? [] }) { g, v, _ in hubbubShareModel(g, v) }
    }

    func testMuddle() throws {
        try check("muddle", MuddleShareInput.self, answers: { raw in
            (raw["words"] as? [String] ?? []) + [raw["final"] as? String ?? "", raw["caption"] as? String ?? ""]
        }) { g, v, raw in muddleShareModel(g, v, caption: raw["caption"] as? String) }
    }

    func testLadder() throws {
        try check("ladder", LadderShareInput.self, answers: { $0["words"] as? [String] ?? [] }) { g, v, _ in ladderShareModel(g, v) }
    }

    func testCodebreaker() throws {
        try check("codebreaker", CodebreakerShareInput.self, answers: { [$0["text"] as? String ?? ""] }) { g, v, _ in codebreakerShareModel(g, v) }
    }

    func testCodebreakerShapes() throws {
        let shapes = try XCTUnwrap(try fixture()["shapes"] as? [[String: Any]])
        XCTAssertFalse(shapes.isEmpty)
        for s in shapes {
            let text = try XCTUnwrap(s["text"] as? String)
            XCTAssertEqual(ShareSpoilers.codebreakerShape(text), s["shape"] as? [Int], text)
        }
    }

    /// A muddle with no caption, or an empty one, keeps `caption` null in both variants.
    func testMuddleCaptionNullWhenMissing() {
        let g = MuddleShareInput(words: ["A", "B", "C", "D"], final: "E F", solved: [true], checks: 1, mistakes: 0, hintsUsed: 0)
        XCTAssertNil(muddleShareModel(g, .full).caption)
        XCTAssertNil(muddleShareModel(g, .full, caption: "").caption)
        XCTAssertNil(muddleShareModel(g, .clean, caption: "Hi").caption)
        XCTAssertEqual(muddleShareModel(g, .full, caption: "Hi").caption, "Hi")
        XCTAssertEqual(muddleShareModel(g, .full).solved, [true, false, false, false, false])
    }
}
