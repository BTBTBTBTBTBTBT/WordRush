import XCTest
@testable import WordociousCore

/// The mascot fit system — parity with packages/core avatar-layout.ts via Fixtures/avatar-layout-fixtures.json
/// (the fixture carries the manifest it was computed from, so the check is the CODE, not the bundled file).
final class AvatarLayoutTests: XCTestCase {
    private func fixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "avatar-layout-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private func manifest(_ f: [String: Any]) throws -> AvatarManifest {
        try AvatarManifest.decode(JSONSerialization.data(withJSONObject: try XCTUnwrap(f["manifest"])))
    }

    private func config(_ any: Any?) throws -> AvatarConfig {
        try JSONDecoder().decode(AvatarConfig.self, from: JSONSerialization.data(withJSONObject: try XCTUnwrap(any as? [String: Any])))
    }

    private func rect(_ any: Any?) throws -> AvatarRect {
        let o = try XCTUnwrap(any as? [String: Double])
        return AvatarRect(x: o["x"]!, y: o["y"]!, w: o["w"]!, h: o["h"]!)
    }

    private func close(_ a: AvatarRect, _ b: AvatarRect, _ msg: String) {
        XCTAssertEqual(a.x, b.x, accuracy: 1e-3, msg); XCTAssertEqual(a.y, b.y, accuracy: 1e-3, msg)
        XCTAssertEqual(a.w, b.w, accuracy: 1e-3, msg); XCTAssertEqual(a.h, b.h, accuracy: 1e-3, msg)
    }

    func testLayoutsMatchFixture() throws {
        let f = try fixture()
        let m = try manifest(f)
        let cases = try XCTUnwrap(f["cases"] as? [[String: Any]])
        XCTAssertGreaterThanOrEqual(cases.count, 20)
        for (i, row) in cases.enumerated() {
            let c = try config(row["config"])
            let small = try XCTUnwrap(row["small"] as? Bool)
            let want = try XCTUnwrap(row["layout"] as? [String: Any])
            let got = AvatarFit.layout(c, small: small, manifest: m)
            XCTAssertEqual(got.scale, try XCTUnwrap(want["scale"] as? Double), accuracy: 1e-3, "case \(i)")
            close(got.body, try rect(want["body"]), "case \(i) body")
            close(got.letter, try rect(want["letter"]), "case \(i) letter")
            close(got.bounds, try rect(want["bounds"]), "case \(i) bounds")
            XCTAssertEqual(got.letterIndex, try XCTUnwrap(want["letterIndex"] as? Int), "case \(i) letterIndex")
            let layers = try XCTUnwrap(want["layers"] as? [[String: Any]])
            XCTAssertEqual(got.layers.map(\.art), layers.map { $0["art"] as? String ?? "" }, "case \(i) order")
            for (g, w) in zip(got.layers, layers) {
                close(g.rect, try rect(w["rect"]), "case \(i) \(g.art)")
                XCTAssertEqual(g.tint, w["tint"] as? Bool, "case \(i) \(g.art) tint")
                XCTAssertEqual(g.layer, w["layer"] as? String)
            }
        }
    }

    /// 10-06 rule-based re-ship: a per-body `withheld` override drops the part silently (a saved config that wears it
    /// still lays out); a `layer` override moves a one-art item under the letter (the medal + bow tie).
    func testOverridesWithheldAndLayer() throws {
        let f = try fixture()
        var raw = try XCTUnwrap(f["manifest"] as? [String: Any])
        var bodies = try XCTUnwrap(raw["bodies"] as? [String: Any])
        var classic = try XCTUnwrap(bodies["classic"] as? [String: Any])
        var ov = classic["overrides"] as? [String: Any] ?? [:]
        ov["acc:crown"] = ["withheld": true]
        ov["acc:bowtie"] = ["layer": "under"]
        classic["overrides"] = ov
        bodies["classic"] = classic
        raw["bodies"] = bodies
        let m = try AvatarManifest.decode(JSONSerialization.data(withJSONObject: raw))
        var c = AvatarCatalog.defaultAvatar(userId: "overrides")
        c.body = "classic"; c.head = "crown"; c.neck = "bowtie"
        let l = AvatarFit.layout(c, manifest: m)
        XCTAssertTrue(l.layers.contains { $0.layer == "body" })
        XCTAssertFalse(l.layers.contains { $0.id == "crown" })
        let i = try XCTUnwrap(l.layers.firstIndex { $0.id == "bowtie" })
        XCTAssertEqual(l.layers[i].layer, "under")
        XCTAssertLessThan(i, l.letterIndex)
    }

    func testPicksMatchFixture() throws {
        let f = try fixture()
        let m = try manifest(f)
        for (i, row) in try XCTUnwrap(f["picks"] as? [[String: Any]]).enumerated() {
            let c = try config(row["config"])
            let field = try XCTUnwrap(row["field"] as? String), id = try XCTUnwrap(row["id"] as? String)
            let hit = AvatarFit.pickConflict(c, field: field, id: id, manifest: m)
            if let want = row["conflict"] as? [String: String] {
                XCTAssertEqual(hit?.field, want["field"], "pick \(i)"); XCTAssertEqual(hit?.id, want["id"], "pick \(i)")
            } else {
                XCTAssertNil(hit, "pick \(i)")
            }
            XCTAssertEqual(AvatarFit.applyPick(c, field: field, id: id, manifest: m), try config(row["result"]), "pick \(i)")
        }
    }

    func testPatternShapesMatchFixture() throws {
        for row in try XCTUnwrap(try fixture()["patterns"] as? [[String: Any]]) {
            let p = try XCTUnwrap(row["pattern"] as? String)
            let want = try XCTUnwrap(row["shapes"] as? [[String: Any]])
            let got = AvatarFit.patternShapes(p)
            XCTAssertEqual(got.count, want.count, p)
            for (g, w) in zip(got, want) {
                switch g {
                case let .rect(x, y, ww, h, c, _):
                    XCTAssertEqual(w["t"] as? String, "rect"); XCTAssertEqual(x, w["x"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y, w["y"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(ww, w["w"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(h, w["h"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(c, w["c"] as? String)
                case let .circle(x, y, r, c, a):
                    XCTAssertEqual(w["t"] as? String, "circle"); XCTAssertEqual(x, w["x"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y, w["y"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(r, w["r"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(c, w["c"] as? String); XCTAssertEqual(a, w["a"] as? Double ?? 1, accuracy: 1e-4)
                case let .star(x, y, r, inner, n, c, _):
                    XCTAssertEqual(w["t"] as? String, "star"); XCTAssertEqual(x, w["x"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y, w["y"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(r, w["r"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(inner, w["inner"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(n, w["n"] as? Int); XCTAssertEqual(c, w["c"] as? String)
                case let .heart(x, y, s, c, _):
                    XCTAssertEqual(w["t"] as? String, "heart"); XCTAssertEqual(x, w["x"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y, w["y"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(s, w["s"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(c, w["c"] as? String)
                case let .poly(pts, c, _):
                    XCTAssertEqual(w["t"] as? String, "poly"); XCTAssertEqual(c, w["c"] as? String)
                    let wp = w["pts"] as? [[Double]] ?? []
                    XCTAssertEqual(pts.count, wp.count)
                    for (a, b) in zip(pts, wp) { XCTAssertEqual(a.0, b[0], accuracy: 1e-4); XCTAssertEqual(a.1, b[1], accuracy: 1e-4) }
                case let .grad(x1, y1, x2, y2, stops):
                    XCTAssertEqual(w["t"] as? String, "grad"); XCTAssertEqual(x1, w["x1"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y1, w["y1"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(x2, w["x2"] as? Double ?? -1, accuracy: 1e-4)
                    XCTAssertEqual(y2, w["y2"] as? Double ?? -1, accuracy: 1e-4); XCTAssertEqual(stops.count, (w["stops"] as? [Any])?.count)
                }
            }
        }
    }

    func testCheeksMigrateOnDecode() throws {
        let json = #"{"v":1,"body":"star","color":"mint","pattern":"solid","patternColor":"mint","eyes":"happy","nose":"freckles","mouth":"smile","head":"none","face":"none","neck":"none","frame":"none"}"#
        let c = try JSONDecoder().decode(AvatarConfig.self, from: Data(json.utf8))
        XCTAssertEqual(c.cheeks, "freckles"); XCTAssertEqual(c.nose, "none"); XCTAssertEqual(c.accColor, "default")
    }
}
