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

    static func dismissAllOverlays() {
        rootController?.dismiss(animated: false)
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
