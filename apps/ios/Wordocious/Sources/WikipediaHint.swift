import Foundation

/// 1:1 Swift port of apps/web/components/propernoundle/wikipedia.ts — the
/// ProperNoundle "Clue" hint. Fetches the Wikipedia REST summary for the
/// puzzle's title and returns the first two sentences with the answer name
/// redacted, so the native clue matches exactly what web users see.
enum WikipediaHint {
    private static let api = "https://en.wikipedia.org/api/rest_v1/page/summary"

    /// encodeURIComponent-equivalent allowed set (RFC: unreserved + !~*'() ).
    private static let allowed: CharacterSet = {
        var s = CharacterSet.alphanumerics
        s.insert(charactersIn: "-_.!~*'()")
        return s
    }()

    /// Returns the sanitized hint text, or nil on any failure (caller falls
    /// back to the puzzle's static hint — mirrors the web try/catch).
    /// `redact: false` keeps the answer name in the text — the post-game result
    /// screen shows the full clue as the "definition" (proper nouns aren't in
    /// the dictionary).
    static func fetch(displayName: String, wikiTitle: String?, redact: Bool = true) async -> String? {
        let raw = (wikiTitle?.isEmpty == false ? wikiTitle! : displayName)
            .replacingOccurrences(of: "\\s+", with: "_", options: .regularExpression)
        guard let title = raw.addingPercentEncoding(withAllowedCharacters: allowed),
              let url = URL(string: "\(api)/\(title)") else { return nil }
        var req = URLRequest(url: url)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let extract = obj["extract"] as? String, !extract.isEmpty else { return nil }
            return sanitize(extract, displayName: displayName, redact: redact)
        } catch {
            return nil
        }
    }

    /// The answer's Wikipedia photo (for the post-game result thumbnail) — reads
    /// `thumbnail`/`originalimage` from the same REST summary. nil on any failure.
    static func fetchImageURL(displayName: String, wikiTitle: String?) async -> String? {
        let raw = (wikiTitle?.isEmpty == false ? wikiTitle! : displayName)
            .replacingOccurrences(of: "\\s+", with: "_", options: .regularExpression)
        guard let title = raw.addingPercentEncoding(withAllowedCharacters: allowed),
              let url = URL(string: "\(api)/\(title)") else { return nil }
        var req = URLRequest(url: url)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
            let thumb = (obj["thumbnail"] as? [String: Any])?["source"] as? String
            let original = (obj["originalimage"] as? [String: Any])?["source"] as? String
            return thumb ?? original
        } catch {
            return nil
        }
    }

    // Common single-word abbreviations whose internal period must NOT trigger a
    // sentence split (e.g. "No. 1", "Dr. X", "Inc."). Same list as the web.
    private static let abbreviations = [
        "No", "Nos", "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "Mt", "Ft",
        "Inc", "Ltd", "Co", "Corp", "Bros", "etc", "vs", "cf", "al", "e.g", "i.e",
        "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
        "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat", "Sun",
    ]

    private static func sanitize(_ extract: String, displayName: String, redact: Bool = true) -> String {
        // Protect multi-letter capitalized abbreviations like "U.S.", "U.K.".
        var s = protectDots(extract, pattern: "\\b([A-Z])\\.\\s?([A-Z])\\.(\\s?[A-Z]\\.)?")
        // Protect common single-word abbreviations (case-insensitive).
        for abbr in abbreviations {
            let escaped = NSRegularExpression.escapedPattern(for: abbr)
            s = protectDots(s, pattern: "\\b\(escaped)\\.", options: [.caseInsensitive])
        }
        // First 2 sentences.
        var sentences = matches(in: s, pattern: "[^.!?]+[.!?]+")
        if sentences.isEmpty { sentences = [s] }
        var hint = sentences.prefix(2).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        // Restore protected periods.
        hint = hint.replacingOccurrences(of: "###", with: ".")
        // Post-game (redact=false) keeps the answer in the text.
        guard redact else { return hint }
        // Redact the full name, then each word > 2 chars. Match diacritic-
        // insensitively: the display name is plain ASCII ("Shogun") but the
        // Wikipedia extract often carries the accented spelling ("Shōgun") — a
        // literal match misses it and the clue leaks the answer. Decompose the
        // hint to NFD (accents → base + combining mark) and build each pattern
        // to tolerate combining marks between letters (web wikipedia.ts parity).
        hint = hint.decomposedStringWithCanonicalMapping   // NFD
        let parts = displayName.split { $0.isWhitespace }.map(String.init).filter { $0.count > 2 }
        for pattern in ([displayName] + parts) {
            hint = regexReplace(hint, diacriticTolerantPattern(pattern), "______", options: [.caseInsensitive])
        }
        hint = hint.precomposedStringWithCanonicalMapping  // NFC
        // Collapse consecutive redactions, then re-space a redaction glued to a word.
        hint = regexReplace(hint, "(______\\s*)+", "______")
        hint = regexReplace(hint, "______(\\w)", "______ $1")
        return hint
    }

    // MARK: - Regex helpers

    /// Replace every "." with "###" inside each match of `pattern` (reverse
    /// order so length changes don't invalidate later ranges).
    private static func protectDots(_ s: String, pattern: String,
                                    options: NSRegularExpression.Options = []) -> String {
        guard let re = try? NSRegularExpression(pattern: pattern, options: options) else { return s }
        var result = s
        let ms = re.matches(in: s, range: NSRange(s.startIndex..., in: s))
        for m in ms.reversed() {
            guard let r = Range(m.range, in: result) else { continue }
            result.replaceSubrange(r, with: String(result[r]).replacingOccurrences(of: ".", with: "###"))
        }
        return result
    }

    private static func matches(in s: String, pattern: String) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = s as NSString
        return re.matches(in: s, range: NSRange(location: 0, length: ns.length))
            .map { ns.substring(with: $0.range) }
    }

    /// Build a regex that matches `name` ignoring diacritics: strip accents
    /// from the name, then between each letter allow a run of combining marks
    /// (so "Shogun" matches the NFD form of "Shōgun" = "Sho\u{0304}gun").
    /// Whitespace in a multi-word name matches any whitespace run.
    private static func diacriticTolerantPattern(_ name: String) -> String {
        let combining = "[\\u0300-\\u036f]*"
        let base = name.folding(options: .diacriticInsensitive, locale: nil)
        var out = ""
        for ch in base {
            if ch.isWhitespace { out += "\\s+" }
            else { out += NSRegularExpression.escapedPattern(for: String(ch)) + combining }
        }
        return out
    }

    private static func regexReplace(_ s: String, _ pattern: String, _ template: String,
                                     options: NSRegularExpression.Options = []) -> String {
        guard let re = try? NSRegularExpression(pattern: pattern, options: options) else { return s }
        let ns = s as NSString
        return re.stringByReplacingMatches(in: s, range: NSRange(location: 0, length: ns.length),
                                           withTemplate: template)
    }
}
