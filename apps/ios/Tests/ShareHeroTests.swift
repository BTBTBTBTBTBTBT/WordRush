import XCTest
@testable import WordociousCore

final class ShareHeroTests: XCTestCase {
    private func fixtures() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "share-hero-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "share-hero-fixtures", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    func testSpecsMatchTheSharedFixture() throws {
        let specs = try XCTUnwrap(fixtures()["specs"] as? [[String: Any]])
        XCTAssertEqual(specs.count, ShareHero.Result.allCases.count * 2)
        for s in specs {
            let r = try XCTUnwrap(ShareHero.Result(rawValue: s["result"] as! String))
            let h = s["halloween"] as! Bool
            let got = ShareHero.spec(r, halloween: h)
            XCTAssertEqual(got.pose, s["pose"] as? String, "\(r) \(h)")
            XCTAssertEqual(got.crown, s["crown"] as? Bool, "\(r) \(h)")
            XCTAssertEqual(got.glow, s["glow"] as? String, "\(r) \(h)")
            XCTAssertEqual(got.gold, s["gold"] as? Bool, "\(r) \(h)")
        }
    }

    func testFramesAndBandMatchTheFixture() throws {
        let f = try fixtures()
        let frames = try XCTUnwrap(f["frames"] as? [String: [String: Double]])
        for (k, v) in frames {
            XCTAssertEqual(ShareHero.frames[k]?.minH, v["minH"], k)
            XCTAssertEqual(ShareHero.frames[k]?.maxH, v["maxH"], k)
        }
        let hero = try XCTUnwrap(f["hero"] as? [String: Double])
        XCTAssertEqual(ShareHero.height, hero["height"])
        XCTAssertEqual(ShareHero.gap, hero["gap"])
        XCTAssertEqual(ShareHero.band(hasHero: true), ShareHero.height + ShareHero.gap)
        XCTAssertEqual(ShareHero.band(hasHero: false), 0)
    }

    func testResultMapping() {
        XCTAssertEqual(ShareHero.result(won: true), .win)
        XCTAssertEqual(ShareHero.result(won: false), .loss)
        XCTAssertEqual(ShareHero.result(won: nil), .neutral)
        XCTAssertEqual([1, 2, 3, 4].map { ShareHero.result(rank: $0) }, [.rank1, .rank2, .rank3, .ranked])
    }
}
