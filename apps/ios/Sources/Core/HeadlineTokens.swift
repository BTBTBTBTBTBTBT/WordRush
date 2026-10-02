import Foundation

/// FINISH_SPEC §AR: live lettering for the rotating personalized headlines. A
/// headline ("WARMING UP · 3 DOWN", "OLIVER LEADS TODAY'S RACE", "YOU'RE #3 TODAY")
/// is split into tokens so every platform styles the same pieces:
///   number → gold soft numbers ("3", "6,976", "#2", "3/8", "3:12", "85%", "3RD")
///   name   → the palette's accent gradient (the player's / a friend's name)
///   star   → the "·" separator, drawn as the tiny gold star sprite
///   text   → the main lettering (spaces included)
/// An exact port of packages/core/src/headline-tokens.ts, asserted against
/// Tests/Fixtures/headline-tokens-fixtures.json.
public enum HeadlineTokenKind: String, Equatable, Decodable {
    case text, number, name, star
}

public struct HeadlineToken: Equatable, Decodable {
    public let kind: HeadlineTokenKind
    public let text: String

    public init(_ kind: HeadlineTokenKind, _ text: String) {
        self.kind = kind
        self.text = text
    }
}

public enum HeadlineTokens {
    /// The separator that becomes the star sprite.
    public static let star: Character = "\u{00B7}"

    private static func isWordChar(_ ch: Character?) -> Bool {
        guard let ch, ch.isASCII else { return false }
        return ch.isLetter || ch.isNumber || ch == "_"
    }

    private static func isDigit(_ ch: Character?) -> Bool {
        guard let ch else { return false }
        return ch.isASCII && ch.isNumber
    }

    private static func isLetter(_ ch: Character?) -> Bool {
        guard let ch else { return false }
        return ch.isASCII && ch.isLetter
    }

    /// `^#?\d+(?:[,.:/]\d+)*(?:%|ST|ND|RD|TH)?` (case-insensitive) at `i`; the match length or nil.
    private static func numberMatch(_ s: [Character], at i: Int) -> Int? {
        var j = i
        if j < s.count, s[j] == "#" { j += 1 }
        let digitsStart = j
        while j < s.count, isDigit(s[j]) { j += 1 }
        guard j > digitsStart else { return nil }
        while j + 1 < s.count, ",.:/".contains(s[j]), isDigit(s[j + 1]) {
            j += 1
            while j < s.count, isDigit(s[j]) { j += 1 }
        }
        if j < s.count, s[j] == "%" {
            j += 1
        } else if j + 1 < s.count {
            let suffix = String(s[j...j + 1]).uppercased()
            if ["ST", "ND", "RD", "TH"].contains(suffix) { j += 2 }
        }
        return j - i
    }

    /// Whether `s[i...]` starts with `name` (case-insensitive).
    private static func startsWith(_ s: [Character], _ name: [Character], at i: Int) -> Bool {
        guard i + name.count <= s.count else { return false }
        for k in 0..<name.count where String(s[i + k]).lowercased() != String(name[k]).lowercased() {
            return false
        }
        return true
    }

    /// Split `text` into styled tokens. `names` are matched case-insensitively as
    /// whole words (longest first); blank names are ignored. Adjacent plain text
    /// merges into one token; nothing is dropped (the tokens join back to `text`).
    public static func split(_ text: String, names: [String] = []) -> [HeadlineToken] {
        let wanted = Array(Set(names.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }))
            .sorted { a, b in a.count != b.count ? a.count > b.count : a < b }
            .map { Array($0) }
        let s = Array(text)
        var out: [HeadlineToken] = []
        func push(_ kind: HeadlineTokenKind, _ piece: String) {
            if kind == .text, let last = out.last, last.kind == .text {
                out[out.count - 1] = HeadlineToken(.text, last.text + piece)
            } else {
                out.append(HeadlineToken(kind, piece))
            }
        }
        var i = 0
        while i < s.count {
            let ch = s[i]
            if ch == star { push(.star, String(ch)); i += 1; continue }
            let prev: Character? = i > 0 ? s[i - 1] : nil
            if !isWordChar(prev) {
                if let name = wanted.first(where: { n in
                    startsWith(s, n, at: i) && !isWordChar(i + n.count < s.count ? s[i + n.count] : nil)
                }) {
                    push(.name, String(s[i..<i + name.count])); i += name.count; continue
                }
                if let n = numberMatch(s, at: i), !isLetter(i + n < s.count ? s[i + n] : nil) {
                    push(.number, String(s[i..<i + n])); i += n; continue
                }
            }
            push(.text, String(ch))
            i += 1
        }
        return out
    }
}
