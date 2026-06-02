import SwiftUI

/// 4-tab shell with a custom bottom nav that matches the web BottomNav
/// (components/ui/bottom-nav.tsx): outline icon + muted label when inactive,
/// filled icon + purple label + a 4px dot when active. The system tab bar is
/// hidden; a custom `BottomNav` is added via safeAreaInset so each tab's
/// content (and its ad banner) insets above it, while TabView keeps every tab's
/// state alive.
struct RootTabView: View {
    @State private var tab: Tab = .home
    // Leaderboard's navigation stack lives here so tab gestures can reset it:
    // re-tapping the active Leaderboard tab pops to root, and leaving the tab
    // clears it so returning shows the leaderboard (not the profile you left on).
    @State private var leaderboardPath: [String] = []
    @ObservedObject private var chrome = ChromeVisibility.shared

    enum Tab: Hashable { case home, leaderboard, profile, records }

    init() { DictionaryLoader.ensureInitialized() }

    /// Tab selection with stack-reset side effects (web-like tab behavior).
    private var tabSelection: Binding<Tab> {
        Binding(
            get: { tab },
            set: { newTab in
                // Re-tap the active Leaderboard tab, or leave it, → reset to root.
                if newTab == .leaderboard && tab == .leaderboard { leaderboardPath = [] }
                if tab == .leaderboard && newTab != .leaderboard { leaderboardPath = [] }
                tab = newTab
            })
    }

    var body: some View {
        TabView(selection: tabSelection) {
            HomeView().tag(Tab.home).tabItem { Label("Home", systemImage: "house") }
            LeaderboardTab(path: $leaderboardPath).tag(Tab.leaderboard).tabItem { Label("Leaderboard", systemImage: "trophy") }
            ProfileTab().tag(Tab.profile).tabItem { Label("Profile", systemImage: "person") }
            RecordsTab().tag(Tab.records).tabItem { Label("Records", systemImage: "crown") }
        }
        .toolbar(.hidden, for: .tabBar)
        // Hide the nav while an immersive screen (a game / solved puzzle) is up
        // so it's full-screen like the web — it otherwise bleeds onto pushed
        // views and steals the height the keyboard/boards need.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !chrome.bottomNavHidden { BottomNav(selection: tabSelection) }
        }
    }
}

/// Shared toggle for the app chrome (bottom nav). Immersive full-screen views
/// call `.hidesBottomNav()`; a counter keeps it correct across overlapping
/// appear/disappear transitions (push A → push B → pop A still hides on B).
final class ChromeVisibility: ObservableObject {
    static let shared = ChromeVisibility()
    private init() {}
    @Published private(set) var hideCount = 0
    var bottomNavHidden: Bool { hideCount > 0 }
    func enterImmersive() { hideCount += 1 }
    func exitImmersive() { hideCount = max(0, hideCount - 1) }
}

private struct ImmersiveChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onAppear { ChromeVisibility.shared.enterImmersive() }
            .onDisappear { ChromeVisibility.shared.exitImmersive() }
    }
}

extension View {
    /// Hide the app's bottom nav while this view is on screen (full-screen play).
    func hidesBottomNav() -> some View { modifier(ImmersiveChrome()) }
}

/// Custom bottom navigation — 1:1 with the web BottomNav.
private struct BottomNav: View {
    @Binding var selection: RootTabView.Tab

    var body: some View {
        HStack(spacing: 0) {
            item(.home, "house", "Home")
            item(.leaderboard, "trophy", "Leaderboard")
            item(.profile, "person", "Profile")
            item(.records, "crown", "Records")
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
        // Background fills into the home-indicator safe area; icons stay above.
        .background(Theme.background, ignoresSafeAreaEdges: .bottom)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1.5) }
    }

    private func item(_ t: RootTabView.Tab, _ icon: String, _ label: String) -> some View {
        let active = selection == t
        let color = active ? Theme.primary : Theme.textMuted
        return Button {
            selection = t
            Haptics.tap()
        } label: {
            VStack(spacing: 3) {
                Image(systemName: active ? "\(icon).fill" : icon)
                    .font(.system(size: 20)).foregroundStyle(color)
                Text(label).font(Brand.font(10, .heavy)).foregroundStyle(color).lineLimit(1)
                // 4px active dot (clear when inactive so all items align).
                Circle().fill(active ? Theme.primary : .clear).frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
