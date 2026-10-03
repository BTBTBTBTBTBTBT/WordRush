import Foundation

// FINISH_SPEC BJ6 (founder 10-03: "make sure we have a clever way to populate longer
// usernames without shrinking anything down or scrolling off screen"): the Home greeting's
// line layout — a 1:1 port of packages/core headline-tokens.ts `headlineLayout`, pinned by
// Fixtures/headline-tokens-fixtures.json (widths / sizes / layouts). Widths are in em of the
// brand lettering (Nunito Black wght 900 advances) + 1% tracking per character + the
// outline / 3D edge (0.24 em). One line when it fits; else the words before the player's
// name on line 1 and the NAME + its "!" / "?" as the full-size hero line(s), breaking a long
// name at natural boundaries, then by characters — never shrunk, truncated or clipped.

public enum HeadlineLayout {
    public static let advanceEm: [Character: Double] = [
        "A": 0.763, "B": 0.702, "C": 0.688, "D": 0.786, "E": 0.614, "F": 0.579, "G": 0.747, "H": 0.786, "I": 0.312,
        "J": 0.39, "K": 0.712, "L": 0.585, "M": 0.884, "N": 0.758, "O": 0.807, "P": 0.676, "Q": 0.807, "R": 0.706,
        "S": 0.651, "T": 0.644, "U": 0.748, "V": 0.742, "W": 1.128, "X": 0.698, "Y": 0.645, "Z": 0.625,
        "0": 0.6, "1": 0.6, "2": 0.6, "3": 0.6, "4": 0.6, "5": 0.6, "6": 0.6, "7": 0.6, "8": 0.6, "9": 0.6,
        " ": 0.286, ",": 0.272, ".": 0.272, "!": 0.272, "?": 0.478, "_": 0.5, "-": 0.445, "'": 0.269, "#": 0.6,
        ":": 0.272, "/": 0.349, "%": 0.964, "+": 0.6, "\u{00B7}": 0.272,
    ]
    static let fallbackEm = 1.128
    public static let trackingEm = 0.01
    public static let edgeEm = 0.24
    public static let maxSize: Double = 38
    public static let sizingLine = "GOOD AFTERNOON,"

    public struct Layout: Equatable {
        public let lines: [String]
        /// The lines that carry the player's name when stacked (the gold hero lines).
        public let nameLines: [Int]
    }

    /// The lettering width of `text` (uppercased) in em (JS code-point iteration parity).
    public static func widthEm(_ text: String) -> Double {
        var w = 0.0
        for scalar in text.uppercased().unicodeScalars {
            w += (advanceEm[Character(scalar)] ?? fallbackEm) + trackingEm
        }
        return ((w + edgeEm) * 1000).rounded() / 1000
    }

    /// The device's full lettering size: the longest fixed greeting line fits, capped at 38.
    public static func fontSize(availableWidth: Double, max: Double = maxSize) -> Double {
        guard availableWidth > 0 else { return max }
        return Swift.max(12, Swift.min(max, (availableWidth / widthEm(sizingLine)).rounded(.down)))
    }

    private static func wrapWords(_ text: String, _ maxEm: Double) -> [String] {
        var out: [String] = []
        var cur = ""
        for w in text.split(separator: " ").map(String.init) where !w.isEmpty {
            let next = cur.isEmpty ? w : "\(cur) \(w)"
            if !cur.isEmpty && widthEm(next) > maxEm { out.append(cur); cur = w } else { cur = next }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    private static func nameSegments(_ name: String) -> [String] {
        func kind(_ c: Character) -> Character {
            if c.isASCII && c.isNumber { return "d" }
            if c.isASCII && c.isLetter { return "a" }
            return "s"
        }
        var segs: [String] = []
        var cur = ""
        var prev: Character? = nil
        for c in name {
            if let p = prev, !cur.isEmpty {
                let boundary = kind(p) == "s"
                    || (kind(p) != "s" && kind(c) != "s" && kind(p) != kind(c))
                    || (p.isLowercase && p.isASCII && c.isUppercase && c.isASCII)
                if boundary { segs.append(cur); cur = "" }
            }
            cur.append(c)
            prev = c
        }
        if !cur.isEmpty { segs.append(cur) }
        return segs
    }

    private static func hardSplit(_ piece: String, _ maxEm: Double) -> [String] {
        var out: [String] = []
        var cur = ""
        for ch in piece {
            if !cur.isEmpty && widthEm(cur + String(ch)) > maxEm { out.append(cur); cur = String(ch) } else { cur.append(ch) }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    private static func trim(_ s: String) -> String { s.trimmingCharacters(in: .whitespaces) }

    private static func nameLines(_ name: String, _ suffix: String, _ maxEm: Double) -> [String] {
        let whole = name.uppercased() + suffix
        if widthEm(whole) <= maxEm { return [whole] }
        var pieces = nameSegments(name).map { $0.uppercased() }
        pieces[pieces.count - 1] += suffix
        var out: [String] = []
        var cur = ""
        for p in pieces {
            let next = cur + p
            if widthEm(trim(next)) <= maxEm { cur = next; continue }
            if !trim(cur).isEmpty { out.append(trim(cur)) }
            if widthEm(trim(p)) <= maxEm { cur = p } else {
                let parts = hardSplit(trim(p), maxEm)
                out.append(contentsOf: parts.dropLast())
                cur = parts.last ?? ""
            }
        }
        if !trim(cur).isEmpty { out.append(trim(cur)) }
        return out
    }

    private static func isWord(_ c: Character?) -> Bool {
        guard let c else { return false }
        return (c.isASCII && (c.isLetter || c.isNumber)) || c == "_"
    }

    /// Lay out a Home headline for `maxEm` (available width ÷ font size). `name` = the stored username.
    public static func layout(_ text: String, name: String, maxEm: Double) -> Layout {
        if widthEm(text) <= maxEm { return Layout(lines: [text], nameLines: []) }
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { return Layout(lines: [text], nameLines: []) }
        let chars = Array(text)
        let up = Array(text.uppercased())
        let nUp = Array(n.uppercased())
        guard up.count == chars.count, nUp.count <= up.count else { return Layout(lines: [text], nameLines: []) }
        var idx = -1
        var i = 0
        while i + nUp.count <= up.count {
            if Array(up[i..<(i + nUp.count)]) == nUp {
                let before: Character? = i > 0 ? up[i - 1] : nil
                let after: Character? = i + nUp.count < up.count ? up[i + nUp.count] : nil
                if !isWord(before) && !isWord(after) { idx = i; break }
            }
            i += 1
        }
        guard idx >= 0 else { return Layout(lines: [text], nameLines: []) }
        let before = trim(String(chars[0..<idx]))
        let after = String(chars[(idx + nUp.count)...])
        let punct = after.allSatisfy { "!?.,".contains($0) } ? after : ""
        var lines = before.isEmpty ? [] : wrapWords(before, maxEm)
        let first = lines.count
        lines.append(contentsOf: nameLines(n, punct, maxEm))
        let named = Array(first..<lines.count)
        if punct.isEmpty && !trim(after).isEmpty { lines.append(contentsOf: wrapWords(trim(after), maxEm)) }
        return Layout(lines: lines, nameLines: named)
    }
}
