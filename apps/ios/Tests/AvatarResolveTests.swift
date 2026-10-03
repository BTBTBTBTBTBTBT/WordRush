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
