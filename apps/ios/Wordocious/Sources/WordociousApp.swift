import SwiftUI

@main
struct WordociousApp: App {
    @StateObject private var auth = AuthService.shared
    @StateObject private var themeManager = ThemeManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .environmentObject(themeManager)
                // Recolor the whole app when the theme changes: preferredColorScheme
                // adapts system chrome, and .id forces a tree rebuild so every
                // Theme.* token re-reads the new palette.
                .preferredColorScheme(themeManager.colorScheme)
                .id(themeManager.theme)
                .task {
                    await auth.bootstrap()
                    StoreManager.shared.start()
                    AdsManager.shared.start()
                }
        }
    }
}
