import SwiftUI
import WordociousCore

/// The Stats page's selection keys. The old horizontal chip rail (and its grid
/// popover) is gone (FINISH_SPEC §C3, founder 2026-10-02): the Stats page now uses
/// the Leaderboard's picker window — the shared `GamePickerCard` (FinishPages.swift)
/// with every game visible at once, the Sweep tile, and a Today | All-time toggle
/// in its header row. A selection is one of these keys, a daily mode's dbKey, or
/// `GamePicker.sweep`.
enum StatsRailKey {
    static let today = "today"
    /// Not a tile (founder, 2026-10-01): selecting it opens All-time and scrolls to
    /// its VS section (the Today card's VS Battle pill and the VS lobby send it).
    static let vs = "vs"
    static let all = "all"
}
