import XCTest
@testable import WordociousCore

/// The fit-check combinations (every body × hat × neck item, plus every face part on every body)
/// render ALL their layers: each layer's art has an image set in the app's Assets.xcassets, laid
/// out from the app's bundled avatar-parts.json (web avatar-art-coverage.test.ts + Android
/// AvatarArtCoverageTest check the same against public/art and drawable-nodpi).
final class AvatarArtCoverageTests: XCTestCase {
    private static let app = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Wordocious/Resources")

    private func manifest() throws -> AvatarManifest {
        try AvatarManifest.decode(Data(contentsOf: Self.app.appendingPathComponent("avatar-parts.json")))
    }

    private func ships(_ art: String) -> Bool {
        FileManager.default.fileExists(atPath: Self.app.appendingPathComponent("Assets.xcassets/\(art).imageset/\(art).png").path)
    }

    private func combos() -> [AvatarConfig] {
        var base = AvatarCatalog.defaultAvatar(userId: "coverage")
        base.pattern = "solid"
        var out: [AvatarConfig] = []
        for body in AvatarCatalog.bodies {
            var b = base; b.body = body
            for head in AvatarCatalog.heads { for neck in AvatarCatalog.necks { var c = b; c.head = head; c.neck = neck; out.append(c) } }
            for v in AvatarCatalog.eyes { var c = b; c.eyes = v; out.append(c) }
            for v in AvatarCatalog.mouths { var c = b; c.mouth = v; out.append(c) }
            for v in AvatarCatalog.noses { var c = b; c.nose = v; out.append(c) }
            for v in AvatarCatalog.cheeks { var c = b; c.cheeks = v; out.append(c) }
            for v in AvatarCatalog.faces { var c = b; c.face = v; out.append(c) }
        }
        return out
    }

    func testEveryCombinationShipsEveryLayer() throws {
        let m = try manifest()
        var missing = Set<String>(), checked = Set<String>(), layers = 0
        let all = combos()
        XCTAssertGreaterThan(all.count, 4800)
        for c in all {
            for small in [false, true] {
                let l = AvatarFit.layout(c, small: small, manifest: m)
                XCTAssertTrue(l.layers.contains { $0.layer == "body" })
                for layer in l.layers {
                    layers += 1
                    if checked.insert(layer.art).inserted, !ships(layer.art) { missing.insert(layer.art) }
                }
            }
        }
        XCTAssertGreaterThan(layers, 20000)
        XCTAssertEqual(missing.sorted(), [])
    }

    func testUnknownIdsFallBackToShippedArt() throws {
        let raw: [String: Any] = [
            "v": 1, "body": "blobfish", "color": "plasma", "pattern": "tartan", "patternColor": "plasma", "eyes": "laser",
            "nose": "freckles", "mouth": "fangs", "head": "jetpack", "face": "visor", "neck": "tail", "frame": "none", "accColor": "chrome",
        ]
        let c = AvatarCatalog.validate(raw)
        XCTAssertEqual(c.cheeks, "freckles"); XCTAssertEqual(c.nose, "none")
        XCTAssertTrue(AvatarCatalog.colors.contains { $0.id == c.color })
        let m = try manifest()
        for small in [false, true] {
            for layer in AvatarFit.layout(c, small: small, manifest: m).layers { XCTAssertTrue(ships(layer.art), layer.art) }
        }
    }
}
