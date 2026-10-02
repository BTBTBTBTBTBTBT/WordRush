import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AN3 build-your-own-mascot config — parity with packages/core
/// avatar-config.ts via Fixtures/avatar-config-fixtures.json.
final class AvatarConfigTests: XCTestCase {
    private func fixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "avatar-config-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private func config(_ any: Any?) throws -> AvatarConfig {
        let obj = try XCTUnwrap(any as? [String: Any])
        let data = try JSONSerialization.data(withJSONObject: obj)
        return try JSONDecoder().decode(AvatarConfig.self, from: data)
    }

    func testCatalogMatchesFixture() throws {
        let f = try fixture()
        let colors = try XCTUnwrap(f["colors"] as? [[String: String]])
        XCTAssertEqual(colors.map { $0["id"]! }, AvatarCatalog.colors.map(\.id))
        XCTAssertEqual(colors.map { $0["hex"]! }, AvatarCatalog.colors.map(\.hex))
        let backdrops = try XCTUnwrap(f["backdrops"] as? [[String: Any]])
        XCTAssertEqual(backdrops.map { $0["id"] as? String }, AvatarCatalog.backdrops.map(\.id))
        XCTAssertEqual(backdrops.map { $0["kind"] as? String }, AvatarCatalog.backdrops.map(\.kind.rawValue))
        XCTAssertEqual(backdrops.map { $0["colors"] as? [String] ?? [] }, AvatarCatalog.backdrops.map(\.colors))
        XCTAssertEqual(AvatarCatalog.backdropIds.first, "auto")
        XCTAssertEqual(AvatarCatalog.bodies.count, 6)
        XCTAssertEqual(AvatarCatalog.heads.count, 22)
        XCTAssertEqual(AvatarCatalog.faces.count + AvatarCatalog.necks.count - 2, 8)
        XCTAssertEqual(AvatarCatalog.colors.count, 16)
    }

    func testDefaultsMatchFixture() throws {
        let rows = try XCTUnwrap(try fixture()["defaults"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for row in rows {
            let uid = try XCTUnwrap((row["seed"] ?? row["userId"]) as? String)
            let accent = row["accent"] as? String
            let want = try config(row["config"])
            XCTAssertEqual(AvatarCatalog.defaultAvatar(userId: uid, accentHex: accent), want, "\(uid) \(accent ?? "nil")")
        }
    }

    func testNearestMatchesFixture() throws {
        let rows = try XCTUnwrap(try fixture()["nearest"] as? [[String: String]])
        for row in rows { XCTAssertEqual(AvatarCatalog.nearestColor(row["hex"]), row["id"], row["hex"] ?? "") }
        XCTAssertEqual(AvatarCatalog.nearestColor(nil), "purple")
    }

    func testValidateMatchesFixture() throws {
        let f = try fixture()
        let fallback = try config(f["fallback"])
        let rows = try XCTUnwrap(f["validate"] as? [[String: Any]])
        for (i, row) in rows.enumerated() {
            let raw = row["raw"] is NSNull ? nil : row["raw"]
            XCTAssertEqual(AvatarCatalog.validate(raw, fallback: fallback), try config(row["result"]), "case \(i)")
        }
    }

    func testProStripMatchesFixture() throws {
        let f = try fixture()
        var base = try config(f["fallback"])
        base.head = "crown"; base.neck = "wings"; base.frame = "diamond"; base.bg = "aurora"
        for row in try XCTUnwrap(f["pro"] as? [[String: Any]]) {
            let isPro = try XCTUnwrap(row["isPro"] as? Bool)
            XCTAssertEqual(AvatarCatalog.enforcePro(base, isPro: isPro), try config(row["result"]))
        }
    }

    func testPresetsMatchFixture() throws {
        let rows = try XCTUnwrap(try fixture()["presets"] as? [[String: Any]])
        XCTAssertEqual(rows.count, 10)
        for row in rows {
            let id = try XCTUnwrap(row["castId"] as? String)
            XCTAssertEqual(AvatarCatalog.castPreset(id), try config(row["config"]), id)
        }
    }

    func testLenientRawPayloadNeverThrows() throws {
        struct Row: Decodable { let avatar_config: AvatarConfigRaw? }
        let dec = JSONDecoder()
        let fb = AvatarCatalog.defaultAvatar(userId: "x", accentHex: "#2563eb")
        for json in [#"{"avatar_config": "nope"}"#, #"{"avatar_config": [1,2]}"#, #"{"avatar_config": 7}"#] {
            let row = try dec.decode(Row.self, from: Data(json.utf8))
            XCTAssertEqual(AvatarCatalog.validate(raw: row.avatar_config, fallback: fb), fb)
        }
        let missing = try dec.decode(Row.self, from: Data("{}".utf8))
        XCTAssertNil(missing.avatar_config)
        let good = try dec.decode(Row.self, from: Data(#"{"avatar_config": {"v": 1, "body": "star", "eyes": "laser", "head": 3}}"#.utf8))
        let v = AvatarCatalog.validate(raw: good.avatar_config, fallback: fb)
        XCTAssertEqual(v.body, "star"); XCTAssertEqual(v.eyes, fb.eyes); XCTAssertEqual(v.head, fb.head)
        // Round trip through the raw form.
        let cfg = AvatarCatalog.castPreset("s")
        let back = try dec.decode(AvatarConfigRaw.self, from: JSONEncoder().encode(AvatarConfigRaw(cfg)))
        XCTAssertEqual(AvatarCatalog.validate(raw: back, fallback: fb), cfg)
    }

    func testWithPhotoDefaultsMatchFixture() throws {
        let rows = try XCTUnwrap(try fixture()["withPhoto"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for row in rows {
            let uid = try XCTUnwrap((row["seed"] ?? row["userId"]) as? String)
            let has = try XCTUnwrap(row["hasPhoto"] as? Bool)
            XCTAssertEqual(AvatarCatalog.defaultAvatar(userId: uid, accentHex: row["accent"] as? String, hasPhoto: has),
                           try config(row["config"]), uid)
        }
    }

    func testDisplayMatchesFixture() throws {
        let rows = try XCTUnwrap(try fixture()["display"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for (i, row) in rows.enumerated() {
            let has = try XCTUnwrap(row["hasPhoto"] as? Bool)
            let fb = AvatarCatalog.defaultAvatar(userId: "x", accentHex: nil, hasPhoto: has)
            XCTAssertEqual(AvatarCatalog.validate(row["raw"], fallback: fb).display, row["result"] as? String, "case \(i)")
        }
        XCTAssertTrue(AvatarCatalog.showsPhoto(display: "photo", hasPhoto: true))
        XCTAssertFalse(AvatarCatalog.showsPhoto(display: "mascot", hasPhoto: true))
        XCTAssertFalse(AvatarCatalog.showsPhoto(display: "photo", hasPhoto: false))
    }

    func testInitial() {
        XCTAssertEqual(AvatarCatalog.initial("johnnyauer"), "J")
        XCTAssertEqual(AvatarCatalog.initial("  _9lives"), "9")
        XCTAssertEqual(AvatarCatalog.initial("__"), "?")
        XCTAssertEqual(AvatarCatalog.initial(nil), "?")
    }

    func testPartsManifestDecodesWithEveryBody() throws {
        // The app bundles a copy of packages/core/src/avatar-parts.json; the built-in
        // placeholder mirrors it, and decoding the JSON shape must stay generic.
        let json = """
        {"version":0,"placeholder":true,"note":"x","bodies":{"classic":{"faceCenter":[0.5,0.42],"eyeY":0.36,"mouthY":0.52,"cheekY":0.47,"headTop":{"x":0.5,"y":0.06,"w":0.62},"neckY":0.7,"letterBox":[0.28,0.56,0.44,0.3]}},"parts":{"eyes":{"slot":"eyeY","scale":0.46}}}
        """
        let parts = try AvatarParts.decode(Data(json.utf8))
        XCTAssertEqual(parts.body("classic").eyeY, 0.36)
        XCTAssertEqual(parts.body("unknown").eyeY, 0.36)
        XCTAssertEqual(parts.part("eyes").scale, 0.46)
        XCTAssertEqual(parts.part("mouth").slot, "mouthY") // falls back to the built-in
        for b in AvatarCatalog.bodies { XCTAssertNotNil(AvatarParts.builtIn.bodies[b], b) }
        XCTAssertEqual(parts.body("classic").y(slot: "headTop"), 0.06)
    }
}
