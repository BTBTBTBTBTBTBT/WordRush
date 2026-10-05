import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AB: every art title / lettering image that ships has a real,
/// non-empty VoiceOver label (the words it shows). Scans the app's asset catalog
/// so a new `art-title-*` / `art-moment-*` / `art-day-*` / `art-game-*` without
/// words fails here.
final class ArtTitleLabelsTests: XCTestCase {
    private var iosRoot: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
    }

    private func letteringAssets() throws -> [String] {
        let catalog = iosRoot.appendingPathComponent("Wordocious/Resources/Assets.xcassets")
        let names = try FileManager.default.contentsOfDirectory(atPath: catalog.path)
        return names.filter { $0.hasSuffix(".imageset") }
            .map { String($0.dropLast(".imageset".count)) }
            .filter { n in ["art-title-", "art-moment-", "art-day-", "art-game-"].contains { n.hasPrefix($0) } }
            .sorted()
    }

    /// Mode id → catalog shareLabel, read from the generated catalog the app labels
    /// `GameTitleArtView` with.
    private func gameLabels() throws -> [String: String] {
        let src = try String(contentsOf: iosRoot.appendingPathComponent("Wordocious/Sources/ModeCatalog.generated.swift"))
        let re = try NSRegularExpression(pattern: #"GenMode\(id: "([^"]+)".*?shareLabel: "([^"]*)""#)
        var out: [String: String] = [:]
        for m in re.matches(in: src, range: NSRange(src.startIndex..., in: src)) {
            if let id = Range(m.range(at: 1), in: src), let label = Range(m.range(at: 2), in: src) {
                out[String(src[id])] = String(src[label])
            }
        }
        return out
    }

    /// Season lettering (season-registry.json `slots.titles` values, e.g. art-title-halloween-quordle) stands
    /// in for a base title; the views keep the base title's label (GameTitleArtView / TitleArt pass it).
    private func seasonalSwaps() throws -> Set<String> {
        let data = try Data(contentsOf: iosRoot.appendingPathComponent("Wordocious/Resources/season-registry.json"))
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let seasons = json?["seasons"] as? [[String: Any]] ?? []
        return Set(seasons.flatMap { (($0["slots"] as? [String: Any])?["titles"] as? [String: String] ?? [:]).values })
    }

    func testEveryShippedLetteringAssetHasALabel() throws {
        let swaps = try seasonalSwaps()
        XCTAssertFalse(swaps.isEmpty, "season-registry.json moved?")
        let assets = try letteringAssets().filter { !swaps.contains($0) }
        XCTAssertFalse(assets.isEmpty, "no lettering assets found — catalog path moved?")
        let games = try gameLabels()
        for name in assets {
            let label = ArtTitleLabels.label(forAsset: name, gameLabels: games)
            XCTAssertNotNil(label, "\(name) has no label in ArtTitleLabels / the mode catalog")
            XCTAssertFalse((label ?? "").trimmingCharacters(in: .whitespaces).isEmpty, "\(name) has an empty label")
        }
    }

    func testRegistryLabelsAreNonEmpty() {
        for (k, v) in ArtTitleLabels.titles { XCTAssertFalse(v.isEmpty, "art-title-\(k)") }
        for (k, v) in ArtTitleLabels.moments { XCTAssertFalse(v.isEmpty, "art-moment-\(k)") }
        XCTAssertEqual(ArtTitleLabels.dayOrder.count, 7)
        for d in ArtTitleLabels.dayOrder { XCTAssertFalse((ArtTitleLabels.days[d] ?? "").isEmpty, "art-day-\(d)") }
    }

    /// The app enums (`ArtTitleName`, `MomentArt` in ArtKit.swift) read their labels
    /// from this registry — every case must have an entry.
    func testAppEnumCasesAreRegistered() throws {
        let src = try String(contentsOf: iosRoot.appendingPathComponent("Wordocious/Sources/ArtKit.swift"))
        func cases(of enumName: String) -> [String] {
            guard let start = src.range(of: "enum \(enumName): String, CaseIterable {"),
                  let end = src.range(of: "var assetName", range: start.upperBound..<src.endIndex) else { return [] }
            return src[start.upperBound..<end.lowerBound].split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { $0.hasPrefix("case ") }
                .flatMap { $0.dropFirst(5).split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) } }
                .map { String($0.split(separator: " ").first ?? "") }
        }
        let titles = cases(of: "ArtTitleName"), moments = cases(of: "MomentArt")
        XCTAssertFalse(titles.isEmpty); XCTAssertFalse(moments.isEmpty)
        for c in titles { XCTAssertNotNil(ArtTitleLabels.titles[c], "ArtTitleName.\(c) has no label") }
        for c in moments { XCTAssertNotNil(ArtTitleLabels.moments[c], "MomentArt.\(c) has no label") }
    }
}
