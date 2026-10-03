import Foundation

/// FINISH_SPEC §AY: the top-left Home button ALWAYS lands on Home's root.
/// - Back stack: it runs the footer's Home route (`TabRouter.tap(.home, …)`) —
///   every cover / sheet dismissed, every stack popped, the Home tab selected — never
///   "one level back" (a game opened from another game, a pushed VS match, a game
///   opened from the Leaderboard tab).
/// - Tap-through: the press must not land on the Home card that ends up under the
///   finger, and a double tap fires once.
public enum HomeButtonRules {
    /// Home cards ignore taps this long after Home was reached by the button.
    public static let cardGuard: TimeInterval = 0.4
    /// Repeat presses within this window are the same press.
    public static let debounce: TimeInterval = 0.8

    /// Whether a Home card tap at `now` counts (false right after the Home button).
    public static func acceptsCardTap(at now: Date, lastHome: Date?) -> Bool {
        guard let lastHome else { return true }
        let dt = now.timeIntervalSince(lastHome)
        return dt < 0 || dt >= cardGuard
    }

    /// Whether a Home-button press at `now` fires (false for a repeat within `debounce`).
    public static func homeFires(at now: Date, lastFire: Date?) -> Bool {
        guard let lastFire else { return true }
        let dt = now.timeIntervalSince(lastFire)
        return dt < 0 || dt >= debounce
    }

    /// The router state for the Home button pressed on a screen: whatever is presented
    /// counts as an overlay, whatever is pushed as depth — the same route as the footer,
    /// minus the scroll: BI11, leaving a game lands on Home where the player left it.
    public static func route(from s: TabRouterState) -> [TabRouterAction] {
        TabRouter.tap(.home, in: TabRouterState(tab: s.tab, depth: s.depth, overlays: s.overlays,
                                                liveVSMatch: false, scrolledToTop: s.scrolledToTop))
            .filter { if case .scrollToTop = $0 { return false } else { return true } }
    }

    /// FINISH_SPEC BI10: whether a tab root going off screen means a screen was PUSHED
    /// over it. A full-screen game cover also takes the root off screen, but it is an
    /// overlay, not depth — counting it as a push made the Home button "pop" Home, which
    /// re-identified Home's whole stack mid-dismissal: every game cover modifier was torn
    /// down and rebuilt, and any game binding still set at that instant presented again
    /// (the "Home opened another game" bug), and Home's scroll reset to the top.
    public static func rootDisappearanceIsPush(tab: AppTab, current: AppTab, modalUp: Bool) -> Bool {
        tab == current && !modalUp
    }

    /// FINISH_SPEC BI10: a game handoff ("Next daily", "Keep playing: Unlimited", a queued
    /// root present) requested at `requestedAt` may still launch only if the Home button
    /// was not pressed since. Home cancels every in-flight launch: no game may open after
    /// the player asked for Home.
    public static func handoffAllowed(requestedAt: Date, lastHome: Date?) -> Bool {
        guard let lastHome else { return true }
        return lastHome < requestedAt
    }
}
