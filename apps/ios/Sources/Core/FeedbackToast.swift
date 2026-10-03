import Foundation

/// FINISH_SPEC §BI9: the in-game feedback popup's classifier, shared by every
/// puzzle game's toast. A "+N" (or "Pangram! +N") flash is a SCORE burst with a
/// word-quality label; everything else is a calm MESSAGE in a tone. Pure, so the
/// thresholds match web (lib/feedback-toast.ts) and Android (FeedbackToast.kt).
public enum FeedbackTone: String, Equatable {
    case success, error, info, win, loss, warn
}

public enum FeedbackKind: Equatable {
    case score(points: Int, pangram: Bool, label: String)
    case message(tone: FeedbackTone)
}

public enum FeedbackToast {
    /// The word-quality label for a score. Hubbub scoring: a 4-letter word is
    /// 1 point, n letters n points, a pangram +7 — so points track word length.
    public static func qualityLabel(points: Int, pangram: Bool) -> String {
        if pangram { return "PANGRAM!" }
        switch points {
        case ...4: return "Good!"
        case 5...6: return "Nice!"
        case 7: return "Great!"
        default: return "Amazing!"
        }
    }

    /// The tone of a non-score game message.
    public static func tone(for message: String) -> FeedbackTone {
        let m = message.lowercased()
        if m.contains("solved") || m.contains("nice") || m.contains("great") || m.contains("rank up") { return .win }
        if m.contains("copied") || m.contains("saved") || m.contains("sent") { return .success }
        if m.hasPrefix("not ") || m.contains("already") || m.contains("enough") || m.contains("invalid")
            || m.contains("must") || m.contains("only") || m.contains("too short") || m.contains("or more")
            || m.contains("missing") { return .error }
        if m.contains("the word was") || m.contains("answer") || m.contains("out of") { return .loss }
        return .info
    }

    /// SCORE for `+N` / `Pangram! +N` (case-insensitive), else MESSAGE.
    public static func kind(_ text: String) -> FeedbackKind {
        let t = text.trimmingCharacters(in: .whitespaces)
        var rest = Substring(t)
        var pangram = false
        if rest.lowercased().hasPrefix("pangram!") {
            pangram = true
            rest = rest.dropFirst("pangram!".count).drop(while: { $0 == " " })
        }
        if rest.first == "+", rest.count > 1, rest.dropFirst().allSatisfy(\.isASCIIDigit), let n = Int(rest.dropFirst()) {
            return .score(points: n, pangram: pangram, label: qualityLabel(points: n, pangram: pangram))
        }
        return .message(tone: tone(for: text))
    }
}

private extension Character {
    var isASCIIDigit: Bool { ("0"..."9").contains(self) }
}
