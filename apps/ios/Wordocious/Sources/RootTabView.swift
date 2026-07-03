import SwiftUI
import WordociousCore

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
    /// Post-game "Next Daily" handoff (NextDailyCTA): the tapped mode's daily,
    /// presented from the tab root so it works no matter which tab/screen
    /// presented the game that just finished.
    @State private var nextDaily: HomeMode?

    enum Tab: Hashable { case home, leaderboard, profile, records }

    init() {
        DictionaryLoader.ensureInitialized()
        // The system tab bar is fully replaced by the custom BottomNav below.
        // `.toolbar(.hidden, for: .tabBar)` alone can FLASH the default (dark
        // translucent) system bar mid-transition when a fullScreenCover game
        // dismisses — hide the UIKit bar globally so it can never render.
        UITabBar.appearance().isHidden = true
    }

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
        // Post-game "Next Daily" handoff: launch the requested mode's daily via
        // the same path the Leaderboard Play CTA uses (GameScreen with today's
        // seed; ProperNoundleView() for PN). The CTA dismisses its own game
        // first, then posts, so this cover presents cleanly from the root.
        .onReceive(NotificationCenter.default.publisher(for: NextDailyCTA.playNextDaily)) { note in
            guard let key = note.object as? String else { return }
            nextDaily = homeModes.first { $0.dbKey == key }
        }
        .fullScreenCover(item: $nextDaily) { m in
            NavigationStack {
                if let gm = m.mode {
                    GameScreen(seed: DailySeed.today(mode: gm), mode: gm, title: m.title)
                } else {
                    ProperNoundleView()   // ProperNoundle daily (dbKey set, no engine mode)
                }
            }
        }
    }
}

/// Shared toggle for the app chrome (bottom nav). Immersive full-screen views
/// call `.hidesBottomNav()`. Tracks the set of currently-present immersive
/// screens by a per-screen ID rather than a counter: each screen's contribution
/// is isolated, so a stray `exit` from one view can't un-hide the nav while
/// another (e.g. a pushed game) is still up — the counter version drifted to 0
/// on unpaired appear/disappear (fullScreenCover dismiss, cancelled swipe-back),
/// which let the nav bleed back onto live game screens.
final class ChromeVisibility: ObservableObject {
    static let shared = ChromeVisibility()
    private init() {}
    @Published private var activeIDs: Set<UUID> = []
    var bottomNavHidden: Bool { !activeIDs.isEmpty }
    func enter(_ id: UUID) { activeIDs.insert(id) }
    func exit(_ id: UUID) { activeIDs.remove(id) }
}

private struct ImmersiveChrome: ViewModifier {
    @State private var id = UUID()
    func body(content: Content) -> some View {
        content
            .onAppear { ChromeVisibility.shared.enter(id) }
            .onDisappear { ChromeVisibility.shared.exit(id) }
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
