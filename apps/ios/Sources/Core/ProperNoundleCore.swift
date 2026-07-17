import Foundation

/// ProperNoundle's pure logic — normalize/evaluate/rebuild, no puzzle data,
/// no SwiftUI. Split out of the app target's ProperNoundle enum so
/// `swift test` can reach it (ProperNoundleReconstructTests) — the app enum
/// forwards to these so call sites are unchanged. Ports
/// components/propernoundle/{game-logic,reconstruct}.ts; Android mirror is
/// core ProperNoundle.kt.
public enum NTile: String, Codable { case correct, present, absent, empty, hintUsed }

public enum ProperNoundleCore {
    /// lowercase, strip diacritics + spaces, keep word chars (mirrors normalizeString).
    public static func normalize(_ s: String) -> String {
        let folded = s.folding(options: .diacriticInsensitive, locale: .current).lowercased()
        return String(folded.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || $0 == "'" || $0 == "-" })
    }

    /// Tile states for a guess vs answer (Wordle two-pass), length-gated.
    public static func evaluate(guess: String, answer: String) -> [NTile] {
        let g = Array(normalize(guess)), a = Array(normalize(answer))
        guard g.count == a.count else { return Array(repeating: .absent, count: g.count) }
        var result = [NTile](repeating: .absent, count: g.count)
        var used = [Bool](repeating: false, count: a.count)
        for i in g.indices where g[i] == a[i] { result[i] = .correct; used[i] = true }
        for i in g.indices where result[i] != .correct {
            for j in a.indices where !used[j] && a[j] == g[i] { result[i] = .present; used[j] = true; break }
        }
        return result
    }

    public static func isWin(_ tiles: [NTile]) -> Bool { !tiles.isEmpty && tiles.allSatisfy { $0 == .correct } }

    /// A recorded hint-row placeholder: the apps pad with spaces, the web with
    /// underscores. Both mean "slot not revealed".
    private static func isPlaceholder(_ c: Character) -> Bool { c == " " || c == "_" }

    /**
     Rebuild ONE recorded ProperNoundle row (letters + tiles) for the completed
     cards. Port of the web `rebuildPNRow` (components/propernoundle/reconstruct.ts).

     Hint rows are recorded POSITIONALLY so the revealed letter sits at its real
     index — the apps write "     i  " (see ProperNoundleView.reveal), the web
     "_____i__". Running either through `normalize` + `evaluate` destroys that:
     `normalize` keeps only alphanumerics, collapsing "     i  " to "i", and
     `evaluate`'s length gate (1 vs 8) then returns a single `.absent` — so the
     letter rendered at slot 0 in gray instead of at its real slot in purple.
     Hint rows are rebuilt from their own positions here and never re-evaluated;
     only real guesses reach the evaluator.

     `letters` uses "" for an unrevealed slot, matching what the mini-board
     expects (see VSResultDetail's realRows mapping).
     */
    public static func rebuildRow(recorded: String, answer: String) -> (letters: [String], tiles: [NTile]) {
        let answerLen = normalize(answer).count
        let raw = Array(recorded.lowercased())
        let revealed = raw.filter { !isPlaceholder($0) }

        // Clue hint: consumes a row without revealing any letter (recorded as "").
        if revealed.isEmpty {
            return (Array(repeating: "", count: answerLen),
                    Array(repeating: .hintUsed, count: answerLen))
        }
        // Vowel/consonant hint: placeholders around the revealed letter(s).
        if raw.count == answerLen, raw.contains(where: isPlaceholder) {
            return (raw.map { isPlaceholder($0) ? "" : String($0).uppercased() },
                    raw.map { isPlaceholder($0) ? .hintUsed : .correct })
        }
        return (Array(normalize(recorded)).map { String($0).uppercased() },
                evaluate(guess: recorded, answer: answer))
    }

    /// Word lengths from the display string (for the tile layout gaps).
    public static func wordGroups(_ display: String) -> [Int] {
        let groups = display.split(separator: " ").map { normalize(String($0)).count }.filter { $0 > 0 }
        return groups.isEmpty ? [normalize(display).count] : groups
    }
}
