import Foundation

/// FINISH_SPEC §AJ: what a footer tab tap does. Tapping Home from anywhere dismisses
/// every sheet / popup / cover, pops every stack and lands on Home's root scrolled to
/// the top; tapping the CURRENT tab pops it to its root (and scrolls to the top);
/// the one exception is a live VS match (quitting is a forfeit) — confirm first.
/// Pure so the rule is unit-tested; RootTabView executes the actions.
public enum AppTab: String, CaseIterable, Codable {
    case home, leaderboard, stats, friends
}

public struct TabRouterState: Equatable {
    public var tab: AppTab
    /// Pushed screens per tab (0 = at the tab's root).
    public var depth: [AppTab: Int]
    /// Sheets / popups / covers presented over the shell.
    public var overlays: Int
    /// A live VS match is on screen (leaving counts as a forfeit).
    public var liveVSMatch: Bool
    /// The tab's root scroll position is at the top.
    public var scrolledToTop: [AppTab: Bool]

    public init(tab: AppTab = .home, depth: [AppTab: Int] = [:], overlays: Int = 0, liveVSMatch: Bool = false,
                scrolledToTop: [AppTab: Bool] = [:]) {
        self.tab = tab; self.depth = depth; self.overlays = overlays; self.liveVSMatch = liveVSMatch
        self.scrolledToTop = scrolledToTop
    }

    /// At the tab's root with nothing over it.
    public func atRoot(_ t: AppTab) -> Bool { overlays == 0 && (depth[t] ?? 0) == 0 }
}

public enum TabRouterAction: Equatable {
    case dismissOverlays
    case popToRoot(AppTab)
    case select(AppTab)
    case scrollToTop(AppTab)
    /// Ask "Leave the match? It counts as a forfeit." first.
    case confirmForfeit
}

public enum TabRouter {
    /// The actions for a tap on `target`, in order.
    public static func tap(_ target: AppTab, in s: TabRouterState) -> [TabRouterAction] {
        if s.liveVSMatch { return [.confirmForfeit] }
        var out: [TabRouterAction] = []
        if s.overlays > 0 { out.append(.dismissOverlays) }
        if target == .home {
            // Home from anywhere: every stack back to its root, then Home at the top.
            for t in AppTab.allCases where (s.depth[t] ?? 0) > 0 { out.append(.popToRoot(t)) }
            if s.tab != .home { out.append(.select(.home)) }
            out.append(.scrollToTop(.home))
            return out
        }
        if target == s.tab {
            // Re-tap the current tab: pop it to its root and scroll to the top.
            if (s.depth[target] ?? 0) > 0 { out.append(.popToRoot(target)) }
            out.append(.scrollToTop(target))
            return out
        }
        out.append(.select(target))
        return out
    }

    /// The state after the actions run (a confirmed forfeit is the caller's to apply).
    public static func apply(_ actions: [TabRouterAction], to s: TabRouterState) -> TabRouterState {
        var n = s
        for a in actions {
            switch a {
            case .dismissOverlays: n.overlays = 0
            case .popToRoot(let t): n.depth[t] = 0
            case .select(let t): n.tab = t
            case .scrollToTop(let t): n.scrolledToTop[t] = true
            case .confirmForfeit: break
            }
        }
        return n
    }
}
