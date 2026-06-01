import SwiftUI

/// 4-tab shell with a custom bottom nav that matches the web BottomNav
/// (components/ui/bottom-nav.tsx): outline icon + muted label when inactive,
/// filled icon + purple label + a 4px dot when active. The system tab bar is
/// hidden; a custom `BottomNav` is added via safeAreaInset so each tab's
/// content (and its ad banner) insets above it, while TabView keeps every tab's
/// state alive.
struct RootTabView: View {
    @State private var tab: Tab = .home

    enum Tab: Hashable { case home, leaderboard, profile, records }

    init() { DictionaryLoader.ensureInitialized() }

    var body: some View {
        TabView(selection: $tab) {
            HomeView().tag(Tab.home).tabItem { Label("Home", systemImage: "house") }
            LeaderboardTab().tag(Tab.leaderboard).tabItem { Label("Leaderboard", systemImage: "trophy") }
            ProfileTab().tag(Tab.profile).tabItem { Label("Profile", systemImage: "person") }
            RecordsTab().tag(Tab.records).tabItem { Label("Records", systemImage: "crown") }
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) { BottomNav(selection: $tab) }
    }
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
