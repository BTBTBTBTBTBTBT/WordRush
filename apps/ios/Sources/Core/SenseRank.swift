import Foundation

/// §259: which sense a word LEADS with. Lives in the Core package so `swift
/// test` can pin it against the shared fixtures. Line-for-line port of the web's
/// lib/sense-rank.ts (and scripts/rank-senses.mjs, which pre-ranks the bundled
/// word-definitions.json). Wiktionary orders parts of speech historically, so
/// NASTY led with "Something nasty." The dataset is pre-ranked; this is the
/// read-time guard so a future dataset with a bad first sense still displays
/// well. Change all four ports together.
///
/// Rank: circular (3) > cross-reference stub (2) > defined through the word (1)
/// > clean (0); ties keep source order.
public enum SenseRank {
    private static func test(_ pattern: String, _ text: String, caseInsensitive: Bool = false) -> Bool {
        guard let re = try? NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : []) else { return false }
        return re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }
    private static func replace(_ pattern: String, in text: String, with rep: String) -> String {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return text }
        return re.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: rep)
    }

    /// The headword or an inflection of it, in LOWERCASE (a capitalised mention is a name).
    public static func mentions(_ word: String, _ def: String) -> Bool {
        let w = word.lowercased()
        if w.count < 3 { return false }
        let stem = (w.hasSuffix("e") || w.hasSuffix("y")) ? String(w.dropLast()) : w
        let pat = "(^|[^A-Za-z])(\(NSRegularExpression.escapedPattern(for: w))|\(NSRegularExpression.escapedPattern(for: stem))(s|es|ed|ing|ies|ied|er|ers|ly|ness|iness))(?![A-Za-z])"
        return test(pat, def)
    }

    /// Labels stripped: "(obsolete)", and a leading usage note "Preceded by the:".
    public static func core(_ def: String) -> String {
        var s = replace("\\([^)]*\\)", in: def, with: "")
        s = replace("^[^:.;]{0,40}:\\s*", in: s, with: "")
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static let frames = "^(something|someone|somebody|anything|one who|one that|those who|that which|the (act|action|state|quality|condition|result|process|sound|instance|manner|fact|practice) of|an? (\\w+ )?(act|action|instance|state|quality|result|sound|process|bout|fit) of|a person who|a thing that|an? \\w+ (thing|things|person|people|event|one|ones)\\b|in an? \\w+ (manner|way)\\b|to (make|become|be|render) \\w+ )"

    public static func isCircular(_ word: String, _ def: String) -> Bool {
        let c = core(def)
        return !c.isEmpty && mentions(word, c) && test(frames, c, caseInsensitive: true)
    }

    public static func isStub(_ def: String) -> Bool {
        let d = def.trimmingCharacters(in: .whitespacesAndNewlines)
        if d.count < 4 { return true }
        return test("^(see\\b|alternative (form|spelling|letter-case form|case form) of|misspelling of|obsolete (form|spelling) of|archaic (form|spelling) of|dated (form|spelling) of|initialism of|abbreviation of|acronym of|synonym of|eye dialect (spelling )?of|clipping of|short for\\b)", d, caseInsensitive: true)
    }

    public static func isDerived(_ word: String, _ def: String) -> Bool {
        let c = core(def)
        if c.isEmpty || !mentions(word, c) { return false }
        let words = c.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        let head = words.prefix(4).joined(separator: " ")
        let tail = words.suffix(2).joined(separator: " ")
        if let first = words.first, mentions(word, first) { return true }
        if words.count <= 6 && mentions(word, tail) { return true }
        if test("^(an?|the|any|one|its)\\b", c, caseInsensitive: true) { return mentions(word, head) }
        if test("^to\\b", c, caseInsensitive: true) { return mentions(word, head) || mentions(word, tail) }
        return false
    }

    public static func score(_ word: String, _ def: String?) -> Int {
        let d = def ?? ""
        if isCircular(word, d) { return 3 }
        if isStub(d) { return 2 }
        return isDerived(word, d) ? 1 : 0
    }

    /// Best score first, source order within a score (stable).
    public static func rank<S>(_ word: String, _ senses: [S], def: (S) -> String?) -> [S] {
        return senses.enumerated()
            .map { (i: $0.offset, s: $0.element, score: score(word, def($0.element))) }
            .sorted { $0.score != $1.score ? $0.score < $1.score : $0.i < $1.i }
            .map { $0.s }
    }
}
