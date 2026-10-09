import XCTest

/// 2.7.1 regression (6f2cf42a): iOS Gauntlet stage 5 (OctoWord) drew only 4 of its 8 boards.
/// A Gauntlet run keeps ONE `BoardLayout` across its stages, so BJ14's staged build
/// (`builtBoards`, `stageBoards()`) ran on appear at QuadWord (stage 2) and never again:
/// when the board count grew to 8, `builtBoards` stayed at 4 and boards 5–8 were blank slots.
///
/// `BoardLayout` lives in the app target (apps/ios/Wordocious/Sources/BoardView.swift), which
/// this package's tests can't import, so — like NoEmojiInUITests — this reads the source and
/// pins the two halves of the contract: staging targets the LIVE board count, and it re-runs
/// whenever that count changes (not only on appear). The board sizing half (8 boards = 2 rows
/// of 4 filling the band) is BoardSizingTests.testOctoWordInPlayIsTwoRowsOfFourFillingTheBand.
///
/// The full UI check needs an XCUITest: launch the DEBUG store shot `gauntlet -gauntletStage 5`
/// and assert 8 board views exist (each `BoardView` would need an accessibility identifier).
final class GauntletStagingTests: XCTestCase {
    private var boardLayoutSource: String {
        get throws {
            let iosRoot = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            let src = try String(contentsOf: iosRoot.appendingPathComponent("Wordocious/Sources/BoardView.swift"), encoding: .utf8)
            let start = try XCTUnwrap(src.range(of: "struct BoardLayout: View {"), "BoardLayout moved; update this test")
            let rest = src[start.upperBound...]
            // BoardLayout runs until the next top-level type.
            let end = rest.range(of: "\n}\n")?.upperBound ?? rest.endIndex
            return String(rest[..<end])
        }
    }

    private func matches(_ pattern: String, in s: String) throws -> Bool {
        let re = try NSRegularExpression(pattern: pattern)
        return re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    func testStagingTargetsTheLiveBoardCount() throws {
        let src = try boardLayoutSource
        XCTAssertTrue(try matches(#"guard\s+builtBoards\s*<\s*vm\.boardCount"#, in: src),
                      "stageBoards() must stage up to the current vm.boardCount")
        XCTAssertTrue(try matches(#"builtBoards\s*=\s*min\(\s*vm\.boardCount"#, in: src),
                      "stageBoards() must never build past the current vm.boardCount")
    }

    func testStagingReRunsWhenTheBoardCountChanges() throws {
        let src = try boardLayoutSource
        XCTAssertTrue(try matches(#"\.onAppear\s*\{[^}]*stageBoards\(\)"#, in: src),
                      "the grid stages on appear")
        // The 2.7.1 fix: a Gauntlet's QuadWord → OctoWord stage changes the count without a new appear.
        XCTAssertTrue(try matches(#"\.onChange\(of:\s*vm\.boardCount\)\s*\{[^}]*stageBoards\(\)"#, in: src),
                      "the grid must stage again when vm.boardCount changes (Gauntlet OctoWord drew 4 of 8 boards)")
    }
}
