import XCTest
@testable import WordociousCore

final class ThemeSurfacesTests: XCTestCase {
    private struct Registry: Decodable {
        struct Look: Decodable { let card, ink, inkSecondary, accent, tabBar: String }
        struct Entry: Decodable { let id: String; let light: Look?; let dark: Look }
        let themes: [Entry]
    }

    /// Parity: core theme-surfaces.ts (theme-surfaces-fixtures.json), over the shipped registry.
    func testMatchesTheSharedFixture() throws {
        func load(_ name: String) throws -> Data {
            let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
                ?? Bundle.module.url(forResource: name, withExtension: "json"))
            return try Data(contentsOf: url)
        }
        let fixtures = try XCTUnwrap(JSONSerialization.jsonObject(with: load("theme-surfaces-fixtures")) as? [String: Any])
        // The registry is not a Fixtures file: read the app's copy by path relative to this test file.
        let regURL = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Wordocious/Resources/theme-registry.json")
        let reg = try JSONDecoder().decode(Registry.self, from: Data(contentsOf: regURL))
        var checked = 0
        for t in reg.themes {
            for (scheme, look) in [("light", t.light), ("dark", t.dark)] {
                guard let look, let want = fixtures["\(t.id):\(scheme)"] as? [String: String] else { continue }
                let r = ThemeSurfaces.tokens(.init(card: look.card, ink: look.ink, inkSecondary: look.inkSecondary, accent: look.accent, tabBar: look.tabBar))
                XCTAssertEqual(r.surface, want["surface"]); XCTAssertEqual(r.surfaceHover, want["surfaceHover"])
                XCTAssertEqual(r.surfaceAlt, want["surfaceAlt"]); XCTAssertEqual(r.border, want["border"])
                XCTAssertEqual(r.borderAlt, want["borderAlt"]); XCTAssertEqual(r.borderLight, want["borderLight"])
                XCTAssertEqual(r.divider, want["divider"]); XCTAssertEqual(r.text, want["text"])
                XCTAssertEqual(r.textSecondary, want["textSecondary"]); XCTAssertEqual(r.textMuted, want["textMuted"], "\(t.id):\(scheme)")
                XCTAssertEqual(r.tabBar, want["tabBar"]); XCTAssertEqual(r.tabEdge, want["tabEdge"])
                checked += 1
            }
        }
        XCTAssertEqual(checked, 7)   // default light/dark, ocean light/dark, forest light/dark, dark
    }
}
