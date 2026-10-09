import Foundation

// 2.8 item 6: the bubble-lettering renderer's PURE half — a 1:1 port of
// packages/core/src/bubble-text.ts, pinned by Fixtures/bubble-text-fixtures.json.
// One line when it fits (the size scales UP to fill the slot, capped at maxSize), else a
// BALANCED 2-3 line wrap, else a hard character split; never an ellipsis, never a clip.

public enum BubbleText {
    /// The glyphs the atlas draws (uppercase; anything else falls back to the live font).
    public static let glyphs = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\u{2605}!?,'\u{00B7}-&")
    /// Flips to true in the commit that drops the glyph PNGs in (asset catalog `bubble-<name>`).
    public static let atlasReady = false
    public static let maxSize: Double = 38
    public static let minSize: Double = 26
    private static let floorSize: Double = 8
    private static let fallbackEm = 1.128
    private static let extraAdvanceEm: [Character: Double] = ["\u{2605}": 0.9, "&": 0.78, "\u{2019}": 0.269]
    private static let glyphNames: [Character: String] = [
        "\u{2605}": "star", "!": "bang", "?": "ask", ",": "comma", "'": "apos", "\u{2019}": "apos",
        "\u{00B7}": "dot", "-": "dash", "&": "amp",
    ]

    public struct Fit: Equatable {
        public let lines: [String]
        public let size: Double
        public let wrapped: Bool
        /// Home only: the lines that carry the player's name when stacked (the gold hero lines).
        public let nameLines: [Int]
        public init(lines: [String], size: Double, wrapped: Bool, nameLines: [Int] = []) {
            self.lines = lines; self.size = size; self.wrapped = wrapped; self.nameLines = nameLines
        }
    }

    /// The asset stem for a character ("a".."z", "0".."9", "star", "bang"…), or nil when the atlas has no glyph.
    public static func glyphName(_ ch: Character) -> String? {
        let s = String(ch).uppercased()
        guard s.count == 1, let up = s.first else { return nil }
        if let n = glyphNames[up] { return n }
        return glyphs.contains(up) ? s.lowercased() : nil
    }

    /// True when the atlas is ready and every non-space character of `text` has a glyph.
    public static func atlasCovers(_ text: String) -> Bool {
        guard atlasReady else { return false }
        return text.allSatisfy { $0 == " " || glyphName($0) != nil }
    }

    /// The lettering width of `text` in em: advances + tracking + the 0.24 em outline / edge.
    public static func widthEm(_ text: String) -> Double {
        var w = 0.0
        for scalar in text.uppercased().unicodeScalars {
            let c = Character(scalar)
            w += (extraAdvanceEm[c] ?? HeadlineLayout.advanceEm[c] ?? fallbackEm) + HeadlineLayout.trackingEm
        }
        return ((w + HeadlineLayout.edgeEm) * 1000).rounded() / 1000
    }

    private static func milli(_ text: String) -> Int { Int((widthEm(text) * 1000).rounded()) }

    private static func sizeFor(_ slot: Double, _ widest: Int, _ maxSize: Double) -> Double {
        guard widest > 0 else { return maxSize }
        return Swift.max(floorSize, Swift.min(maxSize, (slot * 1000 / Double(widest)).rounded(.down)))
    }

    private static func balancedSplit(_ words: [String], _ n: Int) -> [String]? {
        let m = words.count
        guard n >= 1, m >= n else { return nil }
        var w = Array(repeating: Array(repeating: 0, count: m), count: m)
        for i in 0..<m { for j in i..<m { w[i][j] = milli(words[i...j].joined(separator: " ")) } }
        let inf = Int.max / 4
        var best = Array(repeating: Array(repeating: (inf, inf, -1), count: m + 1), count: n + 1)
        best[0][0] = (0, 0, -1)
        for k in 1...n {
            guard k <= m else { break }
            for j in k...m {
                for c in (k - 1)..<j {
                    let prev = best[k - 1][c]
                    if prev.0 == inf { continue }
                    let last = w[c][j - 1]
                    let widest = Swift.max(prev.0, last)
                    let sq = prev.1 + last * last
                    let cur = best[k][j]
                    if widest < cur.0 || (widest == cur.0 && sq < cur.1) { best[k][j] = (widest, sq, c) }
                }
            }
        }
        var out: [String] = []
        var j = m
        var k = n
        while k >= 1 {
            let c = best[k][j].2
            out.insert(words[c..<j].joined(separator: " "), at: 0)
            j = c
            k -= 1
        }
        return out
    }

    private static func hardSplit(_ text: String, _ maxMilli: Int) -> [String] {
        var out: [String] = []
        var cur = ""
        for ch in text {
            if !cur.isEmpty && milli(cur + String(ch)) > maxMilli { out.append(cur); cur = String(ch) } else { cur.append(ch) }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    /// The fit for `text` in a slot `slotWidth` wide.
    public static func fit(_ text: String, slotWidth: Double, maxSize: Double = maxSize, minSize: Double = minSize, maxLines: Int = 3) -> Fit {
        let minS = Swift.min(minSize, maxSize)
        let maxN = Swift.max(2, maxLines)
        let t = text.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        guard !t.isEmpty, slotWidth > 0 else { return Fit(lines: [t], size: maxSize, wrapped: false) }

        let one = sizeFor(slotWidth, milli(t), maxSize)
        if one >= minS { return Fit(lines: [t], size: one, wrapped: false) }

        let words = t.split(separator: " ").map(String.init)
        var last: Fit?
        var n = 2
        while n <= maxN {
            guard let lines = balancedSplit(words, n) else { break }
            let widest = lines.map(milli).max() ?? 0
            let size = sizeFor(slotWidth, widest, maxSize)
            last = Fit(lines: lines, size: size, wrapped: true)
            if size >= minS { return last! }
            n += 1
        }
        let longestWord = words.map(milli).max() ?? 0
        if Double(longestWord) * minS > slotWidth * 1000 {
            let maxMilli = Int((slotWidth * 1000 / minS).rounded(.down))
            var lines: [String] = []
            for w in words {
                if milli(w) <= maxMilli { lines.append(w) } else { lines.append(contentsOf: hardSplit(w, maxMilli)) }
            }
            var packed: [String] = []
            for l in lines {
                if let tail = packed.last, milli(tail + " " + l) <= maxMilli { packed[packed.count - 1] = tail + " " + l } else { packed.append(l) }
            }
            let size = sizeFor(slotWidth, packed.map(milli).max() ?? 0, maxSize)
            return Fit(lines: packed, size: size, wrapped: packed.count > 1)
        }
        return last ?? Fit(lines: [t], size: one, wrapped: false)
    }

    /// The Home headline: the player's name keeps its stacked hero lines, every other headline goes
    /// through `fit` so long ones wrap instead of truncating; `size` is capped at the device's full size.
    public static func homeFit(_ text: String, name: String, slotWidth: Double) -> Fit {
        let size = HeadlineLayout.fontSize(availableWidth: slotWidth)
        let maxEm = slotWidth / size
        let layout = HeadlineLayout.layout(text, name: name, maxEm: maxEm)
        if layout.lines.count > 1 || HeadlineLayout.widthEm(text) <= maxEm {
            return Fit(lines: layout.lines, size: size, wrapped: layout.lines.count > 1, nameLines: layout.nameLines)
        }
        return fit(text, slotWidth: slotWidth, maxSize: size, minSize: (size * 0.72).rounded())
    }
}
