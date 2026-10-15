import XCTest
@testable import WordociousCore

/// FINISH_SPEC BJ4 / BJ5 — parity with packages/core resolveAvatar + podiumLayout via
/// Fixtures/avatar-resolve-fixtures.json and Fixtures/podium-layout-fixtures.json.
final class AvatarResolveTests: XCTestCase {
    private func fixture(_ name: String) throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    func testResolvePrecedenceMatchesFixture() throws {
        let cases = try XCTUnwrap(try fixture("avatar-resolve-fixtures")["cases"] as? [[String: Any]])
        XCTAssertGreaterThan(cases.count, 10)
        for c in cases {
            let src = try XCTUnwrap(c["source"] as? [String: Any])
            let want = try XCTUnwrap(c["result"] as? [String: Any])
            let got = AvatarResolve.resolve(username: src["username"] as? String, avatarUrl: src["avatarUrl"] as? String,
                                            config: src["config"], castId: src["castId"], frame: src["frame"],
                                            accentHex: src["accentHex"] as? String)
            XCTAssertEqual(got.kind.rawValue, want["kind"] as? String, "\(src)")
            XCTAssertEqual(got.photoUrl, want["photoUrl"] as? String, "\(src)")
            let wantConfig = try JSONDecoder().decode(AvatarConfig.self,
                                                      from: JSONSerialization.data(withJSONObject: try XCTUnwrap(want["config"])))
            XCTAssertEqual(got.config, wantConfig, "\(src)")
        }
        let custom = try XCTUnwrap(try fixture("avatar-resolve-fixtures")["custom"] as? [[String: Any]])
        for c in custom {
            XCTAssertEqual(AvatarResolve.isCustomPhotoUrl(c["url"] as? String), c["custom"] as? Bool)
        }
    }

    func testOAuthLetterPictureNeverDrawn() {
        let r = AvatarResolve.resolve(username: "Ukrainian Cyclone", avatarUrl: "https://lh3.googleusercontent.com/a/x", config: nil)
        XCTAssertEqual(r.kind, .seeded)
        XCTAssertNil(r.photoUrl)
    }

    func testPodiumLayoutMatchesFixture() throws {
        let f = try fixture("podium-layout-fixtures")
        let cases = try XCTUnwrap(f["cases"] as? [[String: Any]])
        for c in cases {
            let ranks = try XCTUnwrap(c["ranks"] as? [Int])
            let want = try XCTUnwrap(c["layout"] as? [String: Any])
            let got = PodiumLayout.layout(ranks)
            XCTAssertEqual(got.filled, want["filled"] as? Int, "\(ranks)")
            XCTAssertEqual(got.open, want["open"] as? [Int], "\(ranks)")
        }
        for o in try XCTUnwrap(f["open"] as? [[String: Any]]) {
            let s = PodiumLayout.openSpot(try XCTUnwrap(o["place"] as? Int))
            XCTAssertEqual(s.title, o["title"] as? String)
            XCTAssertEqual(s.line, o["line"] as? String)
        }
    }

    /// The one-image podium geometry (packages/core PODIUM_ART): the literal numbers, and the fixture's "art" once generated.
    func testPodiumArtGeometry() throws {
        XCTAssertEqual(PodiumArt.aspect, 1.5)
        XCTAssertEqual(PodiumArt.order, [2, 1, 3])
        XCTAssertEqual(PodiumArt.step(2).feet, PodiumArt.Point(x: 0.220, y: 0.435))
        XCTAssertEqual(PodiumArt.step(1).feet, PodiumArt.Point(x: 0.500, y: 0.366))
        XCTAssertEqual(PodiumArt.step(3).feet, PodiumArt.Point(x: 0.783, y: 0.455))
        XCTAssertEqual(PodiumArt.step(2).panel, PodiumArt.Panel(x0: 0.103, x1: 0.335, y0: 0.605, y1: 0.810))
        XCTAssertEqual(PodiumArt.step(1).panel, PodiumArt.Panel(x0: 0.383, x1: 0.620, y0: 0.581, y1: 0.799))
        XCTAssertEqual(PodiumArt.step(3).panel, PodiumArt.Panel(x0: 0.667, x1: 0.902, y0: 0.615, y1: 0.810))
        let fx = try fixture("podium-layout-fixtures")
        guard let art = fx["art"] as? [String: Any] else { return }   // not generated yet
        XCTAssertEqual(art["aspect"] as? Double, PodiumArt.aspect)
        XCTAssertEqual(art["maxWidthPt"] as? Double, PodiumArt.maxWidthPt)
        XCTAssertEqual(art["plantPt"] as? Double, PodiumArt.plantPt)
        XCTAssertEqual(art["nameGapPt"] as? Double, PodiumArt.nameGapPt)
        XCTAssertEqual(art["headTop"] as? Double, PodiumArt.headTop)
        XCTAssertEqual(art["crownRise"] as? Double, PodiumArt.crownRise)
        XCTAssertEqual(art["crownGapPt"] as? Double, PodiumArt.crownGapPt)
        let ns = try XCTUnwrap(art["nameSize"] as? [String: Double]), nw = try XCTUnwrap(art["nameWidth"] as? [String: Double])
        XCTAssertEqual(ns["gold"], PodiumArt.nameSizeGold); XCTAssertEqual(ns["other"], PodiumArt.nameSizeOther)
        XCTAssertEqual(nw["gold"], PodiumArt.nameWidthGold); XCTAssertEqual(nw["other"], PodiumArt.nameWidthOther)
        XCTAssertEqual(art["nameMinScale"] as? Double, PodiumArt.nameMinScale)
        let os = try XCTUnwrap(art["openSpot"] as? [String: Double])
        XCTAssertEqual(os["width"], PodiumArt.openSpotWidth)
        XCTAssertEqual(os["aspect"]!, PodiumArt.openSpotAspect, accuracy: 1e-12)
        XCTAssertEqual(os["plantPt"], PodiumArt.openSpotPlantPt)
        XCTAssertEqual(art["shadowWidth"] as? Double, PodiumArt.shadowWidth)
        XCTAssertEqual(art["scoreHeight"] as? Double, PodiumArt.scoreHeight)
        XCTAssertEqual(art["detailHeight"] as? Double, PodiumArt.detailHeight)
        XCTAssertEqual(art["textRgb"] as? [Int], [PodiumArt.textRgb.r, PodiumArt.textRgb.g, PodiumArt.textRgb.b])
        XCTAssertEqual(fx["artOrder"] as? [Int], PodiumArt.order)
        for c in try XCTUnwrap(fx["winnerHead"] as? [[String: String]]) {
            XCTAssertEqual(PodiumArt.winnerHead(c["head"]!.isEmpty ? nil : c["head"]), c["out"])
        }
        if let w = fx["winnerIntro"] as? [String: Any] {
            let g = try XCTUnwrap(w["glow"] as? [String: Any]), sp = try XCTUnwrap(w["sparkles"] as? [String: Any]), c = try XCTUnwrap(w["crown"] as? [String: Any])
            XCTAssertEqual(g["size"] as? Double, PodiumWinnerIntro.glowSize)
            XCTAssertEqual(g["colorRgb"] as? [Int], [PodiumWinnerIntro.glowRgb.r, PodiumWinnerIntro.glowRgb.g, PodiumWinnerIntro.glowRgb.b])
            XCTAssertEqual(g["fromScale"] as? Double, PodiumWinnerIntro.glowFromScale)
            XCTAssertEqual(g["toScale"] as? Double, PodiumWinnerIntro.glowToScale)
            XCTAssertEqual(g["durationMs"] as? Double, PodiumWinnerIntro.glowMs)
            XCTAssertEqual(g["ease"] as? [Double], PodiumWinnerIntro.glowEase)
            XCTAssertEqual(g["restOpacity"] as? Double, PodiumWinnerIntro.glowRestOpacity)
            XCTAssertEqual(sp["offsets"] as? [[Double]], PodiumWinnerIntro.sparkleOffsets)
            XCTAssertEqual(sp["size"] as? Double, PodiumWinnerIntro.sparkleSize)
            XCTAssertEqual(sp["durationMs"] as? Double, PodiumWinnerIntro.sparkleMs)
            XCTAssertEqual(sp["delayMs"] as? Double, PodiumWinnerIntro.sparkleDelayMs)
            XCTAssertEqual(sp["staggerMs"] as? Double, PodiumWinnerIntro.sparkleStaggerMs)
            XCTAssertEqual(sp["driftPt"] as? Double, PodiumWinnerIntro.sparkleDriftPt)
            XCTAssertEqual(sp["peakOpacity"] as? Double, PodiumWinnerIntro.sparklePeakOpacity)
            XCTAssertEqual(sp["colorRgb"] as? [Int], [PodiumWinnerIntro.sparkleRgb.r, PodiumWinnerIntro.sparkleRgb.g, PodiumWinnerIntro.sparkleRgb.b])
            XCTAssertEqual(c["delayMs"] as? Double, PodiumWinnerIntro.crownDelayMs)
            XCTAssertEqual(c["durationMs"] as? Double, PodiumWinnerIntro.crownMs)
            XCTAssertEqual(c["dropPt"] as? Double, PodiumWinnerIntro.crownDropPt)
            XCTAssertEqual(c["settlePt"] as? Double, PodiumWinnerIntro.crownSettlePt)
        }
        let cel = try XCTUnwrap(fx["celebration"] as? [String: Any])
        XCTAssertEqual(try XCTUnwrap(cel["aspect"] as? Double), CelebrationStage.aspect, accuracy: 1e-9)
        XCTAssertEqual(cel["feetX"] as? [Double], CelebrationStage.feetX)
        XCTAssertEqual(cel["footY"] as? Double, CelebrationStage.footY)
        let steps = try XCTUnwrap(art["steps"] as? [[String: Any]])
        XCTAssertEqual(steps.count, PodiumArt.steps.count)
        for (s, mine) in zip(steps, PodiumArt.steps) {
            let feet = try XCTUnwrap(s["feet"] as? [String: Double]), panel = try XCTUnwrap(s["panel"] as? [String: Double])
            XCTAssertEqual(s["place"] as? Int, mine.place)
            XCTAssertEqual(feet["x"], mine.feet.x); XCTAssertEqual(feet["y"], mine.feet.y)
            XCTAssertEqual(panel["x0"], mine.panel.x0); XCTAssertEqual(panel["x1"], mine.panel.x1)
            XCTAssertEqual(panel["y0"], mine.panel.y0); XCTAssertEqual(panel["y1"], mine.panel.y1)
        }
    }

    func testPodiumForNResults() {
        XCTAssertEqual(PodiumLayout.layout([1]).open, [2, 3])
        XCTAssertEqual(PodiumLayout.layout([1, 2]).open, [3])
        XCTAssertEqual(PodiumLayout.layout([1, 2, 3, 4]).filled, 3)
        XCTAssertEqual(PodiumLayout.layout([]).filled, 0)
    }

    func testPortraitFrameFallbacks() {
        XCTAssertEqual(AvatarResolve.portraitFrame(chosen: "silver", pro: true, level: 60), "silver")
        XCTAssertEqual(AvatarResolve.portraitFrame(chosen: "none", pro: true, level: 60), "pro")
        XCTAssertEqual(AvatarResolve.portraitFrame(chosen: "none", pro: false, level: 30), "gold")
        XCTAssertNil(AvatarResolve.portraitFrame(chosen: "none", pro: false, level: nil))
        XCTAssertEqual(AvatarResolve.portraitFrame(chosen: "bogus", pro: false, level: 1), "bronze")
    }
}

/// FINISH_SPEC BJ6 — the Home greeting layout, parity with packages/core headlineLayout via
/// Fixtures/headline-tokens-fixtures.json, plus the every-length walk on the narrowest phone.
final class HeadlineLayoutTests: XCTestCase {
    private func fixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "headline-tokens-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    func testMatchesFixture() throws {
        let f = try fixture()
        XCTAssertEqual(f["sizingLine"] as? String, HeadlineLayout.sizingLine)
        for w in try XCTUnwrap(f["widths"] as? [[String: Any]]) {
            XCTAssertEqual(HeadlineLayout.widthEm(try XCTUnwrap(w["text"] as? String)), try XCTUnwrap(w["em"] as? Double), accuracy: 1e-9)
        }
        for s in try XCTUnwrap(f["sizes"] as? [[String: Any]]) {
            XCTAssertEqual(HeadlineLayout.fontSize(availableWidth: try XCTUnwrap(s["width"] as? Double)), try XCTUnwrap(s["size"] as? Double))
        }
        let layouts = try XCTUnwrap(f["layouts"] as? [[String: Any]])
        XCTAssertGreaterThan(layouts.count, 20)
        for l in layouts {
            let want = try XCTUnwrap(l["layout"] as? [String: Any])
            let got = HeadlineLayout.layout(try XCTUnwrap(l["text"] as? String), name: try XCTUnwrap(l["name"] as? String),
                                            maxEm: try XCTUnwrap(l["maxEm"] as? Double))
            XCTAssertEqual(got.lines, want["lines"] as? [String], "\(l)")
            XCTAssertEqual(got.nameLines, want["nameLines"] as? [Int], "\(l)")
        }
    }

    func testEveryLengthFitsTheNarrowestPhone() {
        let width = 285.0   // SE (375): card 343 − strip padding 24 − sparkles 34
        let size = HeadlineLayout.fontSize(availableWidth: width)
        let maxEm = width / size
        for n in 3...20 {
            for name in [String(repeating: "W", count: n), String(repeating: "M", count: n), String("Ab1_Ab1_Ab1_Ab1_Ab1_".prefix(n))] {
                for greet in ["GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "UP LATE"] {
                    let text = "\(greet), \(name.uppercased())\(greet == "UP LATE" ? "?" : "!")"
                    let l = HeadlineLayout.layout(text, name: name, maxEm: maxEm)
                    for line in l.lines { XCTAssertLessThanOrEqual(HeadlineLayout.widthEm(line), maxEm + 1e-9, text) }
                    XCTAssertEqual(l.lines.joined().replacingOccurrences(of: " ", with: ""), text.replacingOccurrences(of: " ", with: ""))
                }
            }
        }
    }
}
