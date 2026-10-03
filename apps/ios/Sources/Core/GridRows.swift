import Foundation

/// Stats scroll-jump fix (founder, build 237): the Stats page's grids are laid out
/// EAGERLY (rows of indices), never as LazyVGrid / LazyVStack nested in the page's
/// plain ScrollView — a lazy grid there estimates the heights of cells it hasn't built,
/// then corrects them as they scroll in, and the content-size swing yanks the page
/// back up (the picker "keeps coming back into frame" around Achievements).
public enum GridRows {
    /// Indices 0..<count in rows of `columns` (the last row may be short).
    public static func chunk(_ count: Int, columns: Int) -> [[Int]] {
        guard count > 0 else { return [] }
        let c = max(1, columns)
        return stride(from: 0, to: count, by: c).map { Array($0..<min($0 + c, count)) }
    }
}
