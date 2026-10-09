import XCTest
@testable import WordociousCore

/// Parity guard (iOS side): the "are ads serving" switch and the caption it drives must match
/// packages/core/src/ads.ts. Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class AdCopyFixtureTests: XCTestCase {
    private struct Reason: Decodable { let reason: String; let benefit: String }
    private struct Fixtures: Decodable {
        let adsServing: Bool
        let noLimitsCaption: String
        let reasons: [Reason]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "ad-copy-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testAdSwitchAndCaptionMatchCore() throws {
        let f = try load()
        XCTAssertEqual(AdCopy.adsServing, f.adsServing)
        XCTAssertEqual(StatsProfile.proBenefitCaption[.noLimits], f.noLimitsCaption)
        for r in f.reasons { XCTAssertEqual(StatsProfile.proBenefit(forReason: r.reason).rawValue, r.benefit, r.reason) }
    }
}
