import XCTest
@testable import WordociousCore

/// Poses + the living mascot — parity with packages/core avatar-pose.ts (+ the posed path of avatar-layout.ts) via
/// Fixtures/avatar-pose-fixtures.json. The fixture carries the pose data it was computed from (`data`) and
/// avatar-layout-fixtures.json the manifest, so the check is the CODE, not the bundled files.
final class AvatarPoseTests: XCTestCase {
    private let tol = 1e-9

    private func load(_ name: String) throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private func fixture() throws -> [String: Any] { try load("avatar-pose-fixtures") }

    private func poses(_ f: [String: Any]) throws -> AvatarPosesData {
        try AvatarPosesData.decode(JSONSerialization.data(withJSONObject: try XCTUnwrap(f["data"])))
    }

    private func manifest() throws -> AvatarManifest {
        try AvatarManifest.decode(JSONSerialization.data(withJSONObject: try XCTUnwrap(try load("avatar-layout-fixtures")["manifest"])))
    }

    private func config(_ any: Any?) throws -> AvatarConfig {
        try JSONDecoder().decode(AvatarConfig.self, from: JSONSerialization.data(withJSONObject: try XCTUnwrap(any as? [String: Any])))
    }

    private func spec(_ any: Any?) throws -> AvatarPoseSpec {
        try JSONDecoder().decode(AvatarPoseSpec.self, from: JSONSerialization.data(withJSONObject: try XCTUnwrap(any as? [String: Any])))
    }

    private func nums(_ any: Any?, _ msg: String) throws -> [Double] {
        try XCTUnwrap(any as? [Double], msg)
    }

    private func close(_ a: Double?, _ b: Double?, _ msg: String) {
        guard let a, let b else { XCTAssertEqual(a, b, msg); return }
        XCTAssertEqual(a, b, accuracy: tol, msg)
    }

    private func close(_ a: [Double], _ b: [Double], _ msg: String) {
        XCTAssertEqual(a.count, b.count, msg)
        for (x, y) in zip(a, b) { XCTAssertEqual(x, y, accuracy: tol, msg) }
    }

    private func close(_ a: AvatarRect, _ b: Any?, _ msg: String) throws {
        let o = try XCTUnwrap(b as? [String: Double], msg)
        close(a.x, o["x"], msg + " x"); close(a.y, o["y"], msg + " y"); close(a.w, o["w"], msg + " w"); close(a.h, o["h"], msg + " h")
    }

    private func close(_ a: AvatarPoseParts, _ b: Any?, _ msg: String) throws {
        let o = try XCTUnwrap(b as? [String: Any], msg)
        for k in ["root", "armL", "armR", "handL", "handR", "feet"] { close(a[k], try nums(o[k], msg + " " + k), msg + " " + k) }
        if let base = o["base"] { close(a.base, try nums(base, msg + " base"), msg + " base") }
    }

    private func close(_ a: AvatarPoseSpec, _ b: AvatarPoseSpec, _ msg: String) {
        for (side, x, y) in [("L", a.arms?.L, b.arms?.L), ("R", a.arms?.R, b.arms?.R)] {
            close(x?.rot, y?.rot, "\(msg) arm\(side).rot"); close(x?.dx, y?.dx, "\(msg) arm\(side).dx"); close(x?.dy, y?.dy, "\(msg) arm\(side).dy")
        }
        close(a.body?.dy, b.body?.dy, msg + " body.dy"); close(a.body?.rot, b.body?.rot, msg + " body.rot")
        close(a.body?.sx, b.body?.sx, msg + " body.sx"); close(a.body?.sy, b.body?.sy, msg + " body.sy")
        close(a.feet?.dy, b.feet?.dy, msg + " feet.dy"); close(a.feet?.sx, b.feet?.sx, msg + " feet.sx"); close(a.feet?.sy, b.feet?.sy, msg + " feet.sy")
    }

    private func close(_ got: AvatarLayout, _ want: Any?, _ msg: String) throws {
        let w = try XCTUnwrap(want as? [String: Any], msg)
        close(got.scale, w["scale"] as? Double, msg + " scale")
        try close(got.body, w["body"], msg + " body")
        try close(got.letter, w["letter"], msg + " letter")
        try close(got.bounds, w["bounds"], msg + " bounds")
        XCTAssertEqual(got.letterIndex, w["letterIndex"] as? Int, msg + " letterIndex")
        let layers = try XCTUnwrap(w["layers"] as? [[String: Any]], msg)
        XCTAssertEqual(got.layers.map(\.art), layers.map { $0["art"] as? String ?? "" }, msg + " order")
        for (g, l) in zip(got.layers, layers) {
            let m = "\(msg) \(g.art)"
            try close(g.rect, l["rect"], m)
            XCTAssertEqual(g.tint, l["tint"] as? Bool, m + " tint")
            XCTAssertEqual(g.layer, l["layer"] as? String, m + " layer")
            XCTAssertEqual(g.field, l["field"] as? String, m + " field")
            XCTAssertEqual(g.id, l["id"] as? String, m + " id")
            XCTAssertEqual(g.ride, l["ride"] as? String, m + " ride")
            if let lm = l["m"] { close(try XCTUnwrap(g.m, m + " m"), try nums(lm, m + " m"), m + " m") } else { XCTAssertNil(g.m, m + " m") }
        }
        if let lm = w["letterM"] { close(try XCTUnwrap(got.letterM, msg + " letterM"), try nums(lm, msg), msg + " letterM") } else { XCTAssertNil(got.letterM, msg + " letterM") }
        if let p = w["pose"] as? [String: Any] {
            let gp = try XCTUnwrap(got.pose, msg + " pose")
            XCTAssertEqual(gp.id, p["id"] as? String, msg + " pose id")
            try close(gp.parts, p["parts"], msg + " pose parts")
        } else {
            XCTAssertNil(got.pose, msg + " pose")
        }
    }

    // MARK: Constants

    func testFlagAndConstantsMatchFixture() throws {
        let f = try fixture()
        let flag = try XCTUnwrap(f["flag"] as? [String: Any])
        XCTAssertEqual(AvatarLiveConfig.livingMascot, flag["livingMascot"] as? Bool)
        XCTAssertEqual(AvatarLiveConfig.maxAnimated, flag["maxAnimated"] as? Int)
        XCTAssertEqual(AvatarLiveConfig.androidIdleStill, flag["androidIdleStill"] as? Bool)
        XCTAssertEqual(AvatarPose.ids, f["poses"] as? [String])
        let rp = try XCTUnwrap(f["reactionPose"] as? [String: String])
        for k in AvatarReaction.allCases { XCTAssertEqual(k.pose, rp[k.rawValue], k.rawValue) }
        XCTAssertEqual(Set(rp.keys), Set(AvatarReaction.allCases.map(\.rawValue)))
        // the flag is off: the default layout pose is none (every mascot renders exactly as before)
        if !AvatarLiveConfig.livingMascot { XCTAssertNil(AvatarLayoutPose.flagDefault) }
        // JS Math.round semantics (halves toward +∞)
        XCTAssertEqual(AvatarPose.jsRound(-2.5), -2)
        XCTAssertEqual(AvatarPose.jsRound(2.5), 3)
        XCTAssertEqual(AvatarPose.jsRound(-0.4), 0)
    }

    // MARK: Matrices

    func testMatricesMatchFixture() throws {
        let f = try fixture()
        let d = try poses(f)
        let rows = try XCTUnwrap(f["matrices"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for row in rows {
            let body = try XCTUnwrap(row["body"] as? String), pose = try XCTUnwrap(row["pose"] as? String)
            let rig = try XCTUnwrap(AvatarPose.rig(body, data: d), body)
            let def = try XCTUnwrap(AvatarPose.def(pose, data: d), pose)
            try close(AvatarPose.matrices(rig, def.spec), row["m"], "\(body) \(pose)")
        }
    }

    // MARK: Live frames

    func testLiveFramesMatchFixture() throws {
        let f = try fixture()
        let d = try poses(f)
        let rows = try XCTUnwrap(f["frames"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for (i, row) in rows.enumerated() {
            let inp = try XCTUnwrap(row["input"] as? [String: Any])
            var input = AvatarLiveInput(pose: try XCTUnwrap(inp["pose"] as? String), t: try XCTUnwrap(inp["t"] as? Double))
            input.tap = inp["tap"] as? Double
            input.press = inp["press"] as? Double
            input.still = inp["still"] as? Bool ?? false
            input.ambient = inp["ambient"] as? Bool ?? true
            input.blinkSeed = inp["blinkSeed"] as? Double
            if let rx = inp["reaction"] as? [String: Any] {
                let kind = try XCTUnwrap(AvatarReaction(rawValue: try XCTUnwrap(rx["kind"] as? String)))
                input.reaction = (kind: kind, t: try XCTUnwrap(rx["t"] as? Double))
            }
            let want = try XCTUnwrap(row["frame"] as? [String: Any])
            let got = AvatarPose.liveFrame(input, data: d)
            close(got.spec, try spec(want["spec"]), "frame \(i)")
            close(got.eyes, want["eyes"] as? Double, "frame \(i) eyes")
            close(got.laugh, want["laugh"] as? Double, "frame \(i) laugh")
        }
    }

    // MARK: Posed layouts

    func testLayoutsMatchFixture() throws {
        let f = try fixture()
        let d = try poses(f)
        let m = try manifest()
        let rows = try XCTUnwrap(f["layouts"] as? [[String: Any]])
        XCTAssertFalse(rows.isEmpty)
        for (i, row) in rows.enumerated() {
            let c = try config(row["config"])
            XCTAssertNotEqual(c.pose, "none", "case \(i) decodes its pose")
            try close(AvatarFit.layout(c, pose: .saved, manifest: m, poses: d), row["saved"], "case \(i) saved")
            try close(AvatarFit.layout(c, small: true, pose: .saved, manifest: m, poses: d), row["small"], "case \(i) small")
            let frame = AvatarPose.liveFrame(AvatarLiveInput(pose: c.pose, t: 1.7, tap: 0.3), data: d)
            let live = AvatarFit.layout(c, pose: .live(id: c.pose, spec: frame.spec), manifest: m, poses: d)
            try close(live, row["live"], "case \(i) live")
            try close(AvatarFit.layout(c, pose: nil, manifest: m, poses: d), row["none"], "case \(i) none")
            // the un-posed path ignores the pose data entirely
            XCTAssertEqual(AvatarFit.layout(c, pose: nil, manifest: m, poses: d), AvatarFit.layout(c, pose: nil, manifest: m, poses: nil))
            // per-frame parts at the layout's fixed fit land on the layout's own pose parts (up to the fit's rounding)
            let parts = try XCTUnwrap(AvatarFit.layoutPoseParts(live, body: c.body, spec: frame.spec, poses: d))
            let own = try XCTUnwrap(live.pose?.parts)
            for k in ["root", "armL", "armR", "handL", "handR", "feet"] {
                for (x, y) in zip(parts[k], own[k]) { XCTAssertEqual(x, y, accuracy: 5e-3, "case \(i) parts \(k)") }
            }
        }
    }

    func testLiveLayoutIsRiggedAndRoomy() throws {
        let f = try fixture()
        let d = try poses(f)
        let m = try manifest()
        var c = AvatarCatalog.castPreset("w")
        c.body = "classic"
        let live = AvatarFit.liveLayout(c, small: false, manifest: m, poses: d)
        XCTAssertEqual(live.pose?.id, "none")
        XCTAssertTrue(live.layers.contains { $0.art == "art-av-body-classic-base" })
        XCTAssertTrue(live.layers.contains { $0.art == "art-av-body-classic-armL" })
        XCTAssertNotNil(live.letterM)
        // room for the reactions + hop: the live fit is never larger than the plain one
        XCTAssertLessThanOrEqual(live.scale, AvatarFit.layout(c, pose: nil, manifest: m, poses: d).scale + 1e-9)
        // small avatars never pose
        XCTAssertNil(AvatarFit.liveLayout(c, small: true, manifest: m, poses: d).pose)
    }

    // MARK: 2.8 item 13 — reactions, place poses, the code-composed clap

    func testPlacePosesAndCodePoseMatchFixture() throws {
        let f = try fixture()
        let d = try poses(f)
        for row in try XCTUnwrap(f["placePoses"] as? [[String: Any]]) {
            XCTAssertEqual(AvatarPose.placePose(try XCTUnwrap(row["place"] as? Int)), row["pose"] as? String, "\(row)")
        }
        let rs = try XCTUnwrap(f["reactionSeconds"] as? [String: Double])
        for k in AvatarReaction.allCases { XCTAssertEqual(k.seconds, rs[k.rawValue] ?? -1, accuracy: tol, k.rawValue) }
        let hops = try XCTUnwrap(f["reactionHops"] as? [String: [String: Double]])
        for k in AvatarReaction.allCases {
            if let h = k.hops {
                let want = try XCTUnwrap(hops[k.rawValue], k.rawValue)
                XCTAssertEqual(h.n, want["n"] ?? -1, accuracy: tol); XCTAssertEqual(h.per, want["per"] ?? -1, accuracy: tol); XCTAssertEqual(h.amp, want["amp"] ?? -1, accuracy: tol)
            } else { XCTAssertNil(hops[k.rawValue], k.rawValue) }
        }
        let clap = try XCTUnwrap(AvatarPose.def("clap", data: d))
        XCTAssertFalse(AvatarPose.ids.contains("clap"))
        for row in try XCTUnwrap(f["clapMatrices"] as? [[String: Any]]) {
            let body = try XCTUnwrap(row["body"] as? String)
            try close(AvatarPose.matrices(try XCTUnwrap(AvatarPose.rig(body, data: d), body), clap.spec), row["m"], "clap \(body)")
        }
        XCTAssertEqual(AvatarPose.withheld("clap", body: "classic", data: d), AvatarPose.withheld("hug", body: "classic", data: d))
    }

    // MARK: Withheld

    func testWithheldMatchesFixture() throws {
        let f = try fixture()
        let d = try poses(f)
        let rows = try XCTUnwrap(f["withheld"] as? [[String: Any]])
        for row in rows {
            let pose = try XCTUnwrap(row["pose"] as? String), body = try XCTUnwrap(row["body"] as? String)
            XCTAssertEqual(AvatarPose.withheld(pose, body: body, data: d), row["items"] as? [String] ?? [], "\(pose) \(body)")
        }
        XCTAssertEqual(AvatarPose.withheld("none", body: "classic", data: d), [])
    }

    // MARK: Config

    func testConfigPoseValidates() throws {
        let fb = AvatarCatalog.defaultAvatar(userId: "pose")
        XCTAssertEqual(fb.pose, "none")
        XCTAssertEqual(AvatarCatalog.validate(["pose": "wave"], fallback: fb).pose, "wave")
        XCTAssertEqual(AvatarCatalog.validate(["pose": "moonwalk"], fallback: fb).pose, "none")
        XCTAssertEqual(AvatarCatalog.validate(["pose": 7], fallback: fb).pose, "none")
        var c = fb
        XCTAssertNil(c.jsonObject["pose"])   // written only when set: older configs stay byte-identical
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(c), as: UTF8.self).contains("pose"))
        c.pose = "hug"
        XCTAssertEqual(c.jsonObject["pose"] as? String, "hug")
        XCTAssertEqual(try JSONDecoder().decode(AvatarConfig.self, from: JSONEncoder().encode(c)).pose, "hug")
        XCTAssertEqual(AvatarCatalog.validate(raw: AvatarConfigRaw(c), fallback: fb).pose, "hug")
    }
}
