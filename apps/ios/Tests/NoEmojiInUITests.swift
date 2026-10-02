import XCTest

/// FINISH_SPEC §AM3 / AL addendum 2: no system emoji anywhere in the app UI — our
/// 3D art (Icon3D, art-badge-icon-*, art-medal-*, art-react-*) or plain words instead.
/// Emoji may stay ONLY in plain-text channels that can't show images: share caption
/// text, push / notification text and invite message text.
///
/// The app sources aren't in this package's test target, so this reads every Swift
/// file under apps/ios/Wordocious/Sources and apps/ios/WordociousWidget from disk,
/// lexes out the string literals (comments are skipped; interpolations, multi-line
/// and raw strings and `\u{…}` escapes are handled) and fails on any literal holding
/// an emoji scalar unless it's in the explicit allowlist below.
///
/// What counts as emoji: any scalar with Emoji_Presentation, any scalar above
/// U+2000 with the Emoji property (so text-default symbols iOS may still draw as
/// color emoji — ▶ ↔ ⚙ ™ ✔ ⭐ — count too; use an SF Symbol or our art), and the
/// emoji variation selector U+FE0F. Plain typographic symbols are NOT emoji and
/// stay allowed: · – — … → ← ↑ ↓ × ✓ ★ (none of them carry the Emoji property).
/// Core (apps/ios/Sources/Core, e.g. ShareCopy) is share/push text and isn't scanned.
final class NoEmojiInUITests: XCTestCase {
    /// The plain-text call sites allowed to keep an emoji: (file name, a substring of
    /// the literal). Keep this list explicit and SHORT — share captions, push text,
    /// invite text only.
    private static let allowlist: [(file: String, literal: String)] = [
        // Local push: the flawless-streak reminder's title (plain-text push channel).
        ("NotificationService.swift", "FLAWLESS STREAK AT RISK!"),
    ]

    private var iosRoot: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
    }

    static func isEmoji(_ s: Unicode.Scalar) -> Bool {
        if s.value == 0xFE0F { return true }
        let p = s.properties
        if p.isEmojiPresentation { return true }
        return p.isEmoji && s.value > 0x2000
    }

    func testNoEmojiInUIStrings() throws {
        var offenders: [String] = []
        var literalCount = 0
        for dir in ["Wordocious/Sources", "WordociousWidget"] {
            let base = iosRoot.appendingPathComponent(dir)
            guard let files = FileManager.default.enumerator(atPath: base.path) else {
                XCTFail("missing \(base.path)"); continue
            }
            for case let rel as String in files where rel.hasSuffix(".swift") {
                let text = try String(contentsOf: base.appendingPathComponent(rel), encoding: .utf8)
                let name = (rel as NSString).lastPathComponent
                let lexed = SwiftLiteralLexer.lex(text)
                XCTAssertTrue(lexed.clean, "the literal lexer lost track in \(dir)/\(rel) — teach it that syntax")
                for lit in lexed.literals {
                    literalCount += 1
                    guard lit.text.unicodeScalars.contains(where: Self.isEmoji) else { continue }
                    if Self.allowlist.contains(where: { $0.file == name && lit.text.contains($0.literal) }) { continue }
                    offenders.append("\(dir)/\(rel):\(lit.line): \"\(lit.text)\"")
                }
            }
        }
        // Guard against a silently empty scan (wrong path / broken lexer).
        XCTAssertGreaterThan(literalCount, 1000, "scanned too few string literals")
        XCTAssertTrue(offenders.isEmpty,
                      "Emoji in UI strings (FINISH_SPEC §AM3) — use our 3D art or plain words, or add a "
                      + "share/push/invite call site to the allowlist:\n" + offenders.joined(separator: "\n"))
    }

    func testLexerFindsLiteralsAndSkipsComments() {
        let src = #"""
        // a comment with 🔥 is fine
        /* block 🏆 /* nested 👑 */ still comment */
        let a = "plain"
        let b = "has \(x ? "🔥" : "no") inside"
        let c = #"raw "quoted" 👏"#
        let d = "\u{1F525}"
        let e = """
            multi
            line 🎉
            """
        """#
        let lits = SwiftLiteralLexer.literals(in: src)
        let flagged = lits.filter { $0.text.unicodeScalars.contains(where: Self.isEmoji) }
        XCTAssertTrue(lits.contains { $0.text == "plain" && $0.line == 3 })
        XCTAssertEqual(flagged.map(\.line), [4, 4, 5, 6, 7])
        XCTAssertFalse(Self.isEmoji("·") || Self.isEmoji("→") || Self.isEmoji("×") || Self.isEmoji("✓") || Self.isEmoji("★"))
        XCTAssertTrue(Self.isEmoji("🔥") && Self.isEmoji("⭐") && Self.isEmoji("▶"))
    }
}

/// A small Swift lexer that pulls out string literals (with their starting line).
/// An interpolation's nested literals come out on their own, and the outer
/// literal keeps the interpolation's source text too.
enum SwiftLiteralLexer {
    struct Literal { let line: Int; let text: String }

    static func literals(in source: String) -> [Literal] { lex(source).literals }

    /// The literals, plus whether every literal / comment / interpolation closed
    /// (false = the lexer lost track, so its findings can't be trusted).
    static func lex(_ source: String) -> (literals: [Literal], clean: Bool) {
        var lexer = Lexer(Array(source.unicodeScalars))
        lexer.code(untilParen: false)
        return (lexer.out, !lexer.broken)
    }

    private struct Lexer {
        let s: [Unicode.Scalar]
        var i = 0
        var line = 1
        var out: [Literal] = []
        var broken = false

        init(_ s: [Unicode.Scalar]) { self.s = s }

        func at(_ k: Int) -> Unicode.Scalar? { k < s.count ? s[k] : nil }

        /// `n` hashes starting at k?
        func hashes(_ n: Int, at k: Int) -> Bool {
            (0..<n).allSatisfy { at(k + $0) == "#" }
        }

        mutating func code(untilParen: Bool) {
            var depth = 0
            while i < s.count {
                let c = s[i]
                if c == "\n" { line += 1; i += 1; continue }
                if c == "/", at(i + 1) == "/" {
                    while i < s.count, s[i] != "\n" { i += 1 }
                    continue
                }
                if c == "/", at(i + 1) == "*" { blockComment(); continue }
                if c == "\"" || c == "#" {
                    var h = 0
                    while at(i + h) == "#" { h += 1 }
                    if at(i + h) == "\"" {
                        i += h
                        string(hashes: h)
                        continue
                    }
                    i += max(1, h)
                    continue
                }
                if untilParen {
                    if c == "(" { depth += 1 }
                    if c == ")" {
                        if depth == 0 { i += 1; return }
                        depth -= 1
                    }
                }
                i += 1
            }
            if untilParen { broken = true }
        }

        mutating func blockComment() {
            var depth = 0
            while i < s.count {
                if s[i] == "/", at(i + 1) == "*" { depth += 1; i += 2; continue }
                if s[i] == "*", at(i + 1) == "/" {
                    depth -= 1; i += 2
                    if depth == 0 { return }
                    continue
                }
                if s[i] == "\n" { line += 1 }
                i += 1
            }
            broken = true
        }

        /// At the opening quote (hashes already consumed).
        mutating func string(hashes h: Int) {
            let start = line
            let multi = at(i + 1) == "\"" && at(i + 2) == "\""
            i += multi ? 3 : 1
            var text = String.UnicodeScalarView()
            var closed = false
            while i < s.count {
                let c = s[i]
                if c == "\"" {
                    if multi {
                        if at(i + 1) == "\"", at(i + 2) == "\"", hashes(h, at: i + 3) { i += 3 + h; closed = true; break }
                    } else if hashes(h, at: i + 1) {
                        i += 1 + h; closed = true; break
                    }
                }
                if c == "\\", hashes(h, at: i + 1) {
                    let j = i + 1 + h
                    if at(j) == "(" {
                        // Interpolation: lex it as code (nested literals come out on their own).
                        let from = j + 1
                        i = from
                        code(untilParen: true)
                        text.append(contentsOf: s[from..<min(i, s.count)])
                        continue
                    }
                    if at(j) == "u", at(j + 1) == "{" {
                        var k = j + 2
                        var hex = ""
                        while let d = at(k), d != "}" { hex.unicodeScalars.append(d); k += 1 }
                        if let v = UInt32(hex, radix: 16), let u = Unicode.Scalar(v) { text.append(u) }
                        i = k + 1
                        continue
                    }
                    if let e = at(j) {
                        text.append(c); text.append(e)
                        if e == "\n" { line += 1 }
                    }
                    i = j + 1
                    continue
                }
                if c == "\n" { line += 1 }
                text.append(c)
                i += 1
            }
            if !closed { broken = true }
            out.append(Literal(line: start, text: String(text)))
        }
    }
}
