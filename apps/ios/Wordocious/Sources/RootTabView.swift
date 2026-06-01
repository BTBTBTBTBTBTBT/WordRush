import SwiftUI

/// 4-tab shell matching the web bottom-nav (Home / Leaderboard / Profile /
/// Records). Active tint is the brand purple #7c3aed.
struct RootTabView: View {
    init() {
        DictionaryLoader.ensureInitialized()
        // Match the web nav: purple selected, muted gray unselected.
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Theme.background)
        appearance.shadowColor = UIColor(Theme.border)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
            LeaderboardTab()
                .tabItem { Label("Leaderboard", systemImage: "trophy.fill") }
            ProfileTab()
                .tabItem { Label("Profile", systemImage: "person.fill") }
            RecordsTab()
                .tabItem { Label("Records", systemImage: "crown.fill") }
        }
        .tint(Theme.primary)
        // Bottom banner for free users (above the tab bar). Hidden for Pro.
        .safeAreaInset(edge: .bottom) { AdBannerContainer() }
    }
}
