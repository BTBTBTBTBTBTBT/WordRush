import XCTest
@testable import WordociousCore

/// Doug (Android, 2026-10-05): typing 1-Across in "The Turning Year" (cw-kzdl08), the H landed in the cell
/// where 2-Down starts and "ITE" ran down 2-Down. Mirrors packages/core crossword.test.ts "cursor".
final class CrosswordCursorTests: XCTestCase {
    private let p = CrosswordPuzzle(id: "cw-kzdl08", title: "The Turning Year", theme: "seasons", w: 10, h: 11, entries: [
        CrosswordEntry(n: 1, dir: .across, r: 0, c: 3, answer: "WHITE", clue: "A ____ Christmas"),
        CrosswordEntry(n: 2, dir: .down, r: 0, c: 4, answer: "HUSH", clue: "____, little baby, don't say a word"),
        CrosswordEntry(n: 3, dir: .down, r: 0, c: 7, answer: "EFFECT", clue: "A snowball ____"),
        CrosswordEntry(n: 4, dir: .down, r: 0, c: 9, answer: "BLOSSOM", clue: "Cherry ____"),
        CrosswordEntry(n: 5, dir: .down, r: 3, c: 1, answer: "TURKEY", clue: "Go cold ____"),
        CrosswordEntry(n: 6, dir: .across, r: 3, c: 3, answer: "SHOWERS", clue: "Sunshine and ____"),
    ])
    private func at(_ r: Int, _ c: Int) -> Int { crosswordIndex(w: p.w, r: r, c: c) }

    private func typeWord(_ word: String, startDir: CrosswordDir) -> (CrosswordState, CrosswordCursor, [Int]) {
        var s = createCrosswordState(p, seed: "xw-cursor", startTime: 0)
        var cur = CrosswordCursor(cell: at(0, 3), dir: startDir)
        var visited: [Int] = []
        for ch in word {
            let entry = crosswordActiveEntry(s, cell: cur.cell, dir: cur.dir)
            visited.append(cur.cell)
            s = crosswordReduce(s, .set(cell: cur.cell, letter: String(ch)))
            cur = crosswordCursorAfterType(s, from: cur.cell, entry: entry) ?? cur
        }
        return (s, cur, visited)
    }

    func testTypingWhiteFillsOneAcrossThroughTheCellsWhereDownWordsStart() {
        let (s, cur, visited) = typeWord("WHITE", startDir: .across)
        XCTAssertEqual(visited, [3, 4, 5, 6, 7])
        let fill = Array(s.fill)
        XCTAssertEqual(String(crosswordEntryCells(s, p.entries[0]).map { fill[$0] }), "WHITE")
        XCTAssertEqual(fill[at(1, 4)], CROSSWORD_EMPTY) // nothing ran down 2-Down
        XCTAssertEqual(cur.dir, .across) // complete: on to the next Across with an empty cell (6A)
        XCTAssertEqual(crosswordActiveEntry(s, cell: cur.cell, dir: cur.dir)?.n, 6)
    }

    func testAStaleDownDirectionNeverTurnsTheWord() {
        let (s, _, visited) = typeWord("WHITE", startDir: .down)
        XCTAssertEqual(visited, [3, 4, 5, 6, 7])
        let fill = Array(s.fill)
        XCTAssertEqual(String(crosswordEntryCells(s, p.entries[0]).map { fill[$0] }), "WHITE")
    }

    func testToggleFlipsOnlyWhereBothPassAndAWordEndFillsItsGapFirst() {
        let s0 = createCrosswordState(p, seed: "xw-cursor", startTime: 0)
        XCTAssertEqual(crosswordToggleDir(s0, cell: at(0, 4), dir: .across), .down)
        XCTAssertEqual(crosswordToggleDir(s0, cell: at(0, 5), dir: .across), .across)
        XCTAssertEqual(crosswordToggleDir(s0, cell: at(0, 5), dir: .down), .across)
        let s = crosswordReduce(s0, .set(cell: 7, letter: "E"))
        XCTAssertEqual(crosswordCursorAfterType(s, from: 7, entry: p.entries[0]), CrosswordCursor(cell: 3, dir: .across))
    }

    /// Doug / founder 10-05: the clue number sits inside the corner and never meets the letter, at any cell size.
    func testNumberAndLetterNeverTouch() {
        for cell in stride(from: 14.0, through: 48.0, by: 1.0) {
            let n = CrosswordCellSpec.numberSize(cell: cell), g = CrosswordCellSpec.numberedGlyph(cell: cell)
            let inset = CrosswordCellSpec.inset(cell: cell)
            XCTAssertGreaterThan(inset, cell * 0.035 + 1)            // never on the border or the tile's ring
            let numberBottom = inset * 0.7 + n * 0.92                // top pad + ascent + digit cap height
            let letterScale = (cell < 26 ? 0.56 : 0.5) * g.scale
            let lip = max(1.5, cell * 0.07)
            let letterTop = (cell - lip) / 2 + cell * g.dy - cell * letterScale * 0.36
            let numberRight = inset + n * 0.62 * 2                   // two digits
            let letterLeft = cell / 2 + cell * g.dx - cell * letterScale * 0.42
            XCTAssertTrue(numberBottom < letterTop || numberRight < letterLeft, "cell \(cell)")
        }
    }
}
