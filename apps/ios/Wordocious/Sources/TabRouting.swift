import SwiftUI
import UIKit
import WordociousCore

/// FINISH_SPEC §AJ: the app side of core `TabRouter` — which tab roots currently
/// have something pushed, the per-tab "pop to root" tokens (a tab's NavigationStack
/// re-identifies when its token bumps), and the scroll-to-top signal.
@MainActor
final class TabRouterModel: ObservableObject {
    static let shared = TabRouterModel()

    /// The tab on screen (kept by RootTabView).
    var current: AppTab = .home
    /// Tab roots that have a screen pushed over them (home / stats track it here;
    /// leaderboard / friends read their own path bindings).
    @Published private(set) var pushed: Set<AppTab> = []
    /// Bumped to pop a tab's whole stack.
    @Published private(set) var popTokens: [AppTab: Int] = [:]

    static let scrollToTop = Notification.Name("wordocious.tab-scroll-to-top")

    func token(_ t: AppTab) -> Int { popTokens[t] ?? 0 }

    func rootAppeared(_ t: AppTab) { pushed.remove(t) }

    /// A root disappearing while its tab is current means a screen was pushed over it
    /// (switching tabs also hides it, but then its tab is no longer current).
    func rootDisappeared(_ t: AppTab) { if current == t { pushed.insert(t) } }

    func popToRoot(_ t: AppTab) {
        popTokens[t, default: 0] += 1
        pushed.remove(t)
    }

    /// Whatever the shell has presented (sheets, covers, popovers).
    static var rootPresented: Bool {
        rootController?.presentedViewController != nil
    }

    static func dismissAllOverlays(animated: Bool = false) {
        // §AY: a cover already sliding away (the screen's own dismiss) is left to finish.
        if let p = rootController?.presentedViewController, p.isBeingDismissed, p.presentedViewController == nil { return }
        rootController?.dismiss(animated: animated)
    }

    private static var rootController: UIViewController? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
    }
}

private struct TabRootTracker: ViewModifier {
    let tab: AppTab
    @ObservedObject private var router = TabRouterModel.shared

    func body(content: Content) -> some View {
        content
            .onAppear { router.rootAppeared(tab) }
            .onDisappear { router.rootDisappeared(tab) }
    }
}

extension View {
    /// §AJ: mark this view as `tab`'s ROOT screen (inside its NavigationStack).
    func tabRootTracked(_ tab: AppTab) -> some View { modifier(TabRootTracker(tab: tab)) }
}

/// FINISH_SPEC §AY: the top-left Home button on every game / puzzle / info page /
/// VS / Gauntlet / finished screen. It plays the screen's own close (so the closing
/// animation runs), then the root finishes core `HomeButtonRules.route` — every
/// cover and sheet dismissed, every stack popped, the Home tab selected — so it never
/// lands "one level back" on another game. Single-fire, and Home cards ignore taps
/// for 400 ms after it (no tap-through onto the card under the finger).
@MainActor
enum HomeNav {
    static let goHome = Notification.Name("wordocious.go-home")
    private(set) static var lastHome: Date?
    private static var lastFire: Date?

    static func press(_ local: () -> Void) {
        let now = Date()
        guard HomeButtonRules.homeFires(at: now, lastFire: lastFire) else { return }
        lastFire = now
        lastHome = now
        local()
        // Next turn: the local dismissal has started, so the root only finishes the route.
        DispatchQueue.main.async { NotificationCenter.default.post(name: goHome, object: nil) }
    }

    /// Home cards: false for 400 ms after the Home button.
    static var cardTapsAllowed: Bool { HomeButtonRules.acceptsCardTap(at: Date(), lastHome: lastHome) }
}
