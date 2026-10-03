import Foundation

/// FINISH_SPEC BG: the Stats page is TWO independent selections — the SCOPE
/// (Today | All-time, always showing its selected half) and the GAME (nil = Overview,
/// or one game from the picker). What shows is scope × game. Toggling the scope keeps
/// the game; picking a game keeps the scope; tapping the picked game again returns to
/// Overview; the swipe walks the GAME only. Pure, unit tested.
public enum StatsScope: String, Equatable, CaseIterable {
    case today, allTime
}

public enum StatsView: Equatable {
    case todayOverview
    case todayGame(String)
    case allTimeOverview
    case allTimeGame(String)
}

public struct StatsSelection: Equatable {
    public var scope: StatsScope
    /// A game's key (a daily's dbKey, or the Sweep tile's key); nil = Overview.
    public var game: String?

    public init(scope: StatsScope = .today, game: String? = nil) {
        self.scope = scope
        self.game = game
    }

    /// The page opens on Today + Overview.
    public static let initial = StatsSelection()

    /// The content to show.
    public var view: StatsView {
        switch (scope, game) {
        case (.today, nil): return .todayOverview
        case (.today, let g?): return .todayGame(g)
        case (.allTime, nil): return .allTimeOverview
        case (.allTime, let g?): return .allTimeGame(g)
        }
    }

    /// The toggle — the picked game stays.
    public func withScope(_ s: StatsScope) -> StatsSelection { StatsSelection(scope: s, game: game) }

    /// A picker tap — the scope stays; the picked game again → Overview.
    public func picking(_ g: String) -> StatsSelection {
        StatsSelection(scope: scope, game: game == g ? nil : g)
    }

    /// The swipe: one step through `order` (the picker's games), Overview first —
    /// the scope stays. Off either end → unchanged.
    public func swiped(_ delta: Int, order: [String]) -> StatsSelection {
        let slots: [String?] = [nil] + order.map { Optional($0) }
        guard let i = slots.firstIndex(where: { $0 == game }) else { return self }
        let j = i + delta
        guard slots.indices.contains(j) else { return self }
        return StatsSelection(scope: scope, game: slots[j])
    }
}
