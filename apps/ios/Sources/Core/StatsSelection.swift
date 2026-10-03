import Foundation

/// FINISH_SPEC BJ1 (founder 10-03, replacing BG's Today | All-time toggle: "each game should
/// populate their daily stats first and all time beneath, no more toggle"). The only selection
/// is the GAME (nil = Overview, the Sweep tile's key, or one game from the picker); every view is
/// ONE scroll — its TODAY section first, its ALL-TIME section beneath, always both. Tapping the
/// picked game again returns to Overview; the swipe walks the games. Pure, unit tested; twins:
/// Android StatsNav (StatsRail.kt), web lib/stats-view.ts.
public enum StatsSection: Equatable {
    case todayOverview
    case todayGame(String)
    case todaySweep
    case allTimeOverview
    case allTimeGame(String)
    case allTimeSweep

    /// Whether this is the TODAY half (else ALL-TIME).
    public var isToday: Bool {
        switch self {
        case .todayOverview, .todayGame, .todaySweep: return true
        default: return false
        }
    }
}

public struct StatsSelection: Equatable {
    /// The picker's Sweep tile key (iOS `GamePicker.sweep`).
    public static let sweepKey = "sweep"

    /// A game's key (a daily's dbKey, or the Sweep tile's key); nil = Overview.
    public var game: String?

    public init(game: String? = nil) { self.game = game }

    /// The page opens on Overview.
    public static let initial = StatsSelection()

    /// The view's two sections, top to bottom: Today, then All-time. Always both.
    public var sections: [StatsSection] {
        switch game {
        case nil: return [.todayOverview, .allTimeOverview]
        case Self.sweepKey?: return [.todaySweep, .allTimeSweep]
        case let g?: return [.todayGame(g), .allTimeGame(g)]
        }
    }

    /// A picker tap — the picked game again → Overview.
    public func picking(_ g: String) -> StatsSelection {
        StatsSelection(game: game == g ? nil : g)
    }

    /// A jump (a Today row, a link) — never toggles off.
    public func opening(_ g: String?) -> StatsSelection { StatsSelection(game: g) }

    /// The swipe: one step through `order` (the picker's games), Overview first.
    /// Off either end, or an unknown game → unchanged.
    public func swiped(_ delta: Int, order: [String]) -> StatsSelection {
        let slots: [String?] = [nil] + order.map { Optional($0) }
        guard let i = slots.firstIndex(where: { $0 == game }) else { return self }
        let j = i + delta
        guard slots.indices.contains(j) else { return self }
        return StatsSelection(game: slots[j])
    }
}
