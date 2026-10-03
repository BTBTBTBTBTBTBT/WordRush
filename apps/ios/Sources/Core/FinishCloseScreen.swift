import Foundation

// Founder 10-02 (2.7 (239) screenshots): pure helpers for the finished ("close")
// screen and the win popup, kept in Core so the math is unit-tested.
//  - The dock's "Next <Game> in 3h 12m" line under the SHARE RESULTS candy.
//  - The win popup's answer reveal: one row per word, tiles scaled to fit the card.

public enum FinishCloseScreen {
    /// "3h 12m" (≥ 1 h) or "47m" (< 1 h) until the next daily reset. Minutes round
    /// UP so the line never reads "0m" while a reset is still ahead (minimum "1m").
    public static func countdown(seconds: Int) -> String {
        let minutes = max(1, (max(0, seconds) + 59) / 60)
        let h = minutes / 60, m = minutes % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    /// The share candy's second line: "Next Classic in 3h 12m" (founder 10-02 follow-up:
    /// the countdown rides inside the SHARE RESULTS candy, never a row of its own).
    public static func countdownLine(game: String, seconds: Int) -> String {
        "Next \(game) in \(countdown(seconds: seconds))"
    }

    /// The answer split into its words (one tile row each) — "HUBBLE SPACE
    /// TELESCOPE" → ["HUBBLE", "SPACE", "TELESCOPE"]. Runs of spaces collapse; an
    /// answer with no letters yields no rows.
    public static func answerRows(_ answer: String) -> [String] {
        answer.split(whereSeparator: { $0 == " " }).map(String.init)
    }

    /// The tile width that fits `letters` tiles (`gap` apart) plus `extra` fixed
    /// width (a check badge…) into `width`, never above `maxTile` nor below `minTile`.
    public static func fitTile(letters: Int, width: Double, gap: Double,
                               extra: Double = 0, maxTile: Double, minTile: Double = 12) -> Double {
        let n = Double(max(1, letters))
        let fit = (width - extra - (n - 1) * gap) / n
        return max(minTile, min(maxTile, fit))
    }
}
