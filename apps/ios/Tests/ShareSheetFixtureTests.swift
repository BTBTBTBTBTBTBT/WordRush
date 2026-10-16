import XCTest
@testable import WordociousCore

/// Share-sheet parity guard (iOS side): the model for every fixture context, on every platform, must come out
/// byte-equal (canonical JSON) to packages/core/src/share-sheet.ts, and the tables must match.
/// Fixtures/share-sheet-fixtures.json; regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class ShareSheetFixtureTests: XCTestCase {
    private func fixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "share-sheet-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private func canonical(_ object: Any) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), as: UTF8.self)
    }
    private func canonical<M: Encodable>(_ model: M) throws -> String {
        try canonical(try JSONSerialization.jsonObject(with: JSONEncoder().encode(model)))
    }
    private func decode<T: Decodable>(_ type: T.Type, _ object: Any) throws -> T {
        try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: object))
    }

    func testTablesMatchFixture() throws {
        let f = try fixture()
        XCTAssertEqual(try XCTUnwrap(f["platforms"] as? [String]), SharePlatform.allCases.map(\.rawValue))
        XCTAssertEqual(try XCTUnwrap(f["cardOrder"] as? [String]), ShareSheet.cardOrder.map(\.rawValue))
        XCTAssertEqual(try XCTUnwrap(f["channelOrder"] as? [String]), ShareSheet.channelOrder.map(\.rawValue))
        XCTAssertEqual(try XCTUnwrap(f["linkBase"] as? String), ShareSheet.linkBase)
        XCTAssertEqual(try XCTUnwrap(f["webMobileOnly"] as? [String]), ShareSheet.webMobileOnly.map(\.rawValue))
        XCTAssertEqual(try XCTUnwrap(f["lookLabels"] as? [String: String]), ShareSheet.lookLabels)
        for (k, v) in try XCTUnwrap(f["cardTitles"] as? [String: String]) { XCTAssertEqual(ShareSheet.cardTitles[try XCTUnwrap(ShareCardKind(rawValue: k))], v, k) }
        for (k, v) in try XCTUnwrap(f["surfaceDefaultCard"] as? [String: String]) { XCTAssertEqual(ShareSheet.surfaceDefaultCard[try XCTUnwrap(ShareSurface(rawValue: k))]?.rawValue, v, k) }
        for (k, v) in try XCTUnwrap(f["channelLabels"] as? [String: String]) { XCTAssertEqual(ShareSheet.channelLabels[try XCTUnwrap(ShareChannelId(rawValue: k))], v, k) }
        for (k, v) in try XCTUnwrap(f["channelAvailability"] as? [String: String]) { XCTAssertEqual(ShareSheet.channelAvailability[try XCTUnwrap(ShareChannelId(rawValue: k))]?.rawValue, v, k) }
        for (k, v) in try XCTUnwrap(f["channelSlugs"] as? [String: Any]) {
            let id = try XCTUnwrap(ShareChannelId(rawValue: k))
            XCTAssertEqual(ShareSheet.channelSlugs[id] ?? nil, v as? String, k)
        }
        for (k, row) in try XCTUnwrap(f["channelPayloads"] as? [String: [String: Any]]) {
            let id = try XCTUnwrap(ShareChannelId(rawValue: k))
            for (p, v) in row {
                let platform = try XCTUnwrap(SharePlatform(rawValue: p))
                XCTAssertEqual(ShareSheet.payload(id, platform)?.rawValue, v as? String, "\(k) \(p)")
            }
        }
        for c in try XCTUnwrap(f["frames"] as? [[String: String]]) {
            XCTAssertEqual(channelFrame(try XCTUnwrap(ShareChannelId(rawValue: try XCTUnwrap(c["id"])))).rawValue, c["frame"])
        }
    }

    func testCardsAndLooksMatchFixture() throws {
        let f = try fixture()
        for c in try XCTUnwrap(f["cards"] as? [[String: Any]]) {
            let surface = try XCTUnwrap(ShareSurface(rawValue: try XCTUnwrap(c["surface"] as? String)))
            let available = (c["available"] as? [String] ?? []).compactMap(ShareCardKind.init(rawValue:))
            XCTAssertEqual(try canonical(ShareSheet.cards(surface, available)), try canonical(try XCTUnwrap(c["cards"])), surface.rawValue)
        }
        for l in try XCTUnwrap(f["looks"] as? [[String: Any]]) {
            let season = l["season"] as? String
            XCTAssertEqual(try canonical(ShareSheet.looks(season)), try canonical(try XCTUnwrap(l["looks"])), season ?? "nil")
        }
    }

    func testModelsMatchFixture() throws {
        let models = try XCTUnwrap(try fixture()["models"] as? [[String: Any]])
        XCTAssertFalse(models.isEmpty)
        for m in models {
            let name = try XCTUnwrap(m["name"] as? String)
            let ctx = try decode(ShareSheetContext.self, try XCTUnwrap(m["context"]))
            for platform in SharePlatform.allCases {
                let want = try canonical(try XCTUnwrap(m[platform.rawValue]))
                let got = try canonical(shareSheetModel(ctx, platform))
                XCTAssertEqual(got, want, "\(name) \(platform.rawValue)")
            }
        }
    }

    /// The rules the platform shells lean on, stated once more in plain Swift.
    func testRules() {
        let ctx = ShareSheetContext(surface: .finished, mode: "regions", play: .daily, cards: [.result], hasSpoilerVariant: true, season: "halloween",
                                    caption: ShareSheetCaption(kind: .win, date: "2026-10-16", game: "Starsweep", n: "1"))
        let ios = shareSheetModel(ctx, .ios)
        XCTAssertEqual(ios.channels.map(\.id), [.copy, .messages, .whatsapp, .x, .facebook, .save, .more])
        XCTAssertEqual(ios.hiddenChannels.map(\.id), [.stories, .snapchat, .tiktok])
        XCTAssertEqual(ios.variant.initial, .clean)
        XCTAssertTrue(ios.variant.shown)
        XCTAssertEqual(ios.looks.options.map(\.id), ["halloween", "normal"])
        for ch in ios.channels where ch.id == .messages || ch.id == .whatsapp || ch.id == .more || ch.id == .save {
            XCTAssertEqual(ch.payload, .image); XCTAssertNil(ch.link); XCTAssertNil(ch.text)
        }
        let copy = ios.channels.first { $0.id == .copy }!
        XCTAssertEqual(copy.link, "https://wordocious.com/go/copy?s=finished&m=regions")
        let web = shareSheetModel(ctx, .web)
        XCTAssertTrue(web.channels.first { $0.id == .messages }!.mobileOnly)
        XCTAssertFalse(web.channels.first { $0.id == .x }!.mobileOnly)
        XCTAssertEqual(web.hiddenChannels.map(\.id), [.snapchat])
        XCTAssertEqual(ShareSheet.looks(nil).shown, false)
    }
}
