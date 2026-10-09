import Foundation

/// 2.8 item 40 (screen readers): the spoken words for everything new in 2.8, in ONE place so VoiceOver, TalkBack and ARIA
/// say the same thing. Port of packages/core/src/a11y-labels.ts (pinned by a11y-labels-fixtures.json). Every helper
/// returns a non-empty string, so no image title, headline or mascot is ever silent.
public enum A11yLabels {
    /// "First" / "Second" / "Third" / "#4".
    public static func placeWord(_ place: Int) -> String {
        switch place {
        case 1: return "First"
        case 2: return "Second"
        case 3: return "Third"
        default: return "#\(place)"
        }
    }

    /// A podium place as one spoken line: "First place, doug, 2,005, 4 Guesses · 1m 45s".
    public static func podiumPlace(_ place: Int, name: String, points: String, detail: String?) -> String {
        let d = detail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return "\(placeWord(place)) place, \(name), \(points)\(d.isEmpty ? "" : ", \(d)")"
    }

    /// A free podium place.
    public static func podiumOpenSpot(_ place: Int) -> String { "\(placeWord(place)) place, open spot" }

    /// The button that opens a podium mascot's mini Stage card.
    public static func podiumStageCard(name: String, place: Int) -> String {
        "\(name), \(placeWord(place).lowercased()) place. Opens their stage"
    }

    /// The gold seal on the Flawless popup.
    public static func flawlessSeal(days: Int) -> String { "\(days) Flawless \(days == 1 ? "day" : "days") in a row" }

    /// A changing headline set in bubble letters (or split over lines): the plain sentence, whitespace collapsed.
    public static func headline(_ lines: [String]) -> String {
        let text = lines.joined(separator: " ").components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        return text.isEmpty ? "Headline" : text
    }

    /// A mascot picture: yours, or another player's.
    public static func mascot(own: Bool, name: String?) -> String {
        if own { return "Your mascot" }
        let n = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return n.isEmpty ? "Mascot" : "\(n)'s mascot"
    }

    /// The Home counter ("7 OF 18").
    public static func progress(played: Int, total: Int) -> String { "\(played) of \(total) played today" }
}
