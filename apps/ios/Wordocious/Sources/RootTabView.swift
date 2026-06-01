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
            HomeView().adBanner()
                .tabItem { Label("Home", systemImage: "house.fill") }
            LeaderboardTab().adBanner()
                .tabItem { Label("Leaderboard", systemImage: "trophy.fill") }
            ProfileTab().adBanner()
                .tabItem { Label("Profile", systemImage: "person.fill") }
            RecordsTab().adBanner()
                .tabItem { Label("Records", systemImage: "crown.fill") }
        }
        .tint(Theme.primary)
    }
}
