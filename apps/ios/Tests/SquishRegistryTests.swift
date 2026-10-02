import XCTest

/// FINISH_SPEC §A9 / §AK: everything tappable squishes. A source check over the
/// app: no non-squishing system button styles, and every custom ButtonStyle the
/// app defines routes through the shared `SquishButtonStyle` (or is one of the
/// kit styles that squish on their own: candy buttons, key caps).
final class SquishRegistryTests: XCTestCase {
    private var sources: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Wordocious/Sources")
    }

    private func appSources() throws -> [(String, String)] {
        try FileManager.default.contentsOfDirectory(atPath: sources.path)
            .filter { $0.hasSuffix(".swift") }
            .sorted()
            .map { ($0, try String(contentsOf: sources.appendingPathComponent($0))) }
    }

    func testNoNonSquishingSystemButtonStyles() throws {
        let banned = [".buttonStyle(.plain)", "PlainButtonStyle()", ".buttonStyle(.bordered)",
                      ".buttonStyle(.borderedProminent)", ".buttonStyle(.borderless)", "BorderlessButtonStyle()"]
        for (name, src) in try appSources() {
            for b in banned {
                XCTAssertFalse(src.contains(b), "\(name) uses \(b) — use .squish / .squishCard / .squishIcon / CandyButtonStyle")
            }
        }
    }

    func testCustomButtonStylesSquish() throws {
        let kit: Set<String> = ["SquishButtonStyle", "CandyButtonStyle", "KeyPressStyle"]
        let re = try NSRegularExpression(pattern: #"struct (\w+): ButtonStyle \{"#)
        var found = 0
        for (name, src) in try appSources() {
            for m in re.matches(in: src, range: NSRange(src.startIndex..., in: src)) {
                guard let r = Range(m.range(at: 1), in: src) else { continue }
                let style = String(src[r])
                found += 1
                if kit.contains(style) { continue }
                // The style's body (up to the next top-level declaration) must use the squish.
                let rest = src[r.upperBound...]
                let body = rest.prefix(while: { _ in true }).components(separatedBy: "\n}\n").first ?? ""
                XCTAssertTrue(body.contains("SquishButtonStyle"), "\(name): \(style) doesn't route through SquishButtonStyle")
            }
        }
        XCTAssertGreaterThan(found, 0)
    }
}
