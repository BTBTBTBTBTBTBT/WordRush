import Foundation

// ============================================================
// Shared display formatters — cross-platform contract
// ============================================================
// Mirrors web lib/format.ts + lib/composite-scoring.ts formatScore and
// Android ui/Format.kt / ModeCatalog.formatScore, all pinned by
// display-format-fixtures.json (DisplayFormatFixtureTests). Lives in
// WordociousCore so `swift test` reaches it. These exist because each
// platform hand-rolled its own copies and they drifted: bare Int() here
// showed "2332" where web/Android showed "2,332"; the rank badge truncated
// ("Top 13%") where web rounded ("Top 12%"); and t=0 rendered "—" here but
// "0s" elsewhere.

private let scoreFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    // Pin the separators outright rather than trusting locale data —
    // en_US_POSIX notably applies NO grouping at all (caught by
    // DisplayFormatFixtureTests on first run).
    f.usesGroupingSeparator = true
    f.groupingSeparator = ","
    f.groupingSize = 3
    f.decimalSeparator = "."
    f.maximumFractionDigits = 0
    // Truncate, never round: one result must not read 2,332 on one platform
    // and 2,333 on another (web Math.trunc / Android toLong parity).
    f.roundingMode = .down
    return f
}()

/// A composite score for display: truncated to a whole number, US-grouped.
/// `2332.8` → `"2,332"`.
public func formatScore(_ score: Double) -> String {
    scoreFormatter.string(from: NSNumber(value: score.rounded(.towardZero))) ?? String(Int(score))
}

private func decimalScoreFormatter(_ digits: Int) -> NumberFormatter {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.usesGroupingSeparator = true
    f.groupingSeparator = ","
    f.groupingSize = 3
    f.decimalSeparator = "."
    f.minimumFractionDigits = digits
    f.maximumFractionDigits = digits
    return f
}
private let oneDecimalFormatter = decimalScoreFormatter(1)
private let twoDecimalFormatter = decimalScoreFormatter(2)

/// TIE-AWARE score labels for a board of rows shown together — mirrors web
/// composite-scoring.ts `tieAwareScoreLabels` 1:1. Scores are fractional
/// (speed carries the decimals) but display truncates, so a 1-second gap can
/// read as a tie (2,328.8 vs 2,328.0 both showed "2,328" — 2026-08-08).
/// Rows sharing a whole number render the minimal decimals (1, then 2) that
/// separate the group; identical stored scores are a TRUE tie and keep the
/// integer, as does every non-colliding row.
public func tieAwareScoreLabels(_ scores: [Double]) -> [Double: String] {
    var out: [Double: String] = [:]
    var byTrunc: [Int: [Double]] = [:]  // trunc → DISTINCT raw values
    for s in scores where out[s] == nil {
        out[s] = formatScore(s)
        byTrunc[Int(s.rounded(.towardZero)), default: []].append(s)
    }
    for vals in byTrunc.values where vals.count >= 2 {
        let oneDecimal = Set(vals.map { ($0 * 10).rounded() })
        let digits = oneDecimal.count == vals.count ? 1 : 2
        let formatter = digits == 1 ? oneDecimalFormatter : twoDecimalFormatter
        for v in vals {
            out[v] = formatter.string(from: NSNumber(value: v)) ?? out[v]
        }
    }
    return out
}

/// Compact time for leaderboard/records/summary rows: "0s", "45s", "2m",
/// "2m 5s". Zero is a real value ("0s"), never a dash.
public func formatShortTime(_ seconds: Int) -> String {
    let s = max(0, seconds)
    if s < 60 { return "\(s)s" }
    let m = s / 60, rem = s % 60
    return rem > 0 ? "\(m)m \(rem)s" : "\(m)m"
}

/// The daily post-game rank badge: percentile of the field you beat, ROUNDED
/// (user decision 2026-07-16 — web canonical; this platform used to truncate).
/// `gold` drives the amber styling at the 75th percentile.
///
/// This is the (1 - (rank-1)/total) definition used by the post-game badge.
/// The records page uses rank/total — a different, deliberately separate
/// metric; do not unify them.
public func topPercentLabel(rank: Int, totalPlayers: Int) -> (label: String, gold: Bool) {
    let percentile = Int(((1 - Double(rank - 1) / Double(totalPlayers)) * 100).rounded())
    return ("Top \(max(1, 100 - percentile))%", percentile >= 75)
}
