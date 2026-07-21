import SwiftUI
import GoogleSignIn

@main
struct WordociousApp: App {
    @StateObject private var auth = AuthService.shared
    @StateObject private var themeManager = ThemeManager.shared
    @Environment(\.scenePhase) private var scenePhase

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
                    GamePersistence.shared.cleanupStaleDailyGames()
                    await auth.bootstrap()
                    StoreManager.shared.start()
                    AdsManager.shared.start()
                    PresenceService.shared.start()
                    // Re-fire any solo results whose record calls were cut off
                    // (killed mid-flight / offline finish) — idempotent, solo-only.
                    await PendingRecords.drain()
                }
                // Keep the always-on presence socket alive only while
                // foregrounded + signed in, so the LIVE count reflects real
                // active players (mirrors the web SitePresenceProvider).
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        PresenceService.shared.start()
                        // Recompute the daily reminder: if today's 9 dailies are
                        // done (or it's past 18:00) it rolls to tomorrow, so a
                        // finished day never gets tonight's nudge.
                        Task { await NotificationService.reschedule() }
                    } else if phase == .background { PresenceService.shared.stop() }
                }
                // Every daily completion re-evaluates the reminder — completing
                // the 9th daily flips tonight's reminder to tomorrow 18:00.
                .onDailyCompletion { Task { await NotificationService.reschedule() } }
                .onChange(of: auth.profile?.id) { id in
                    if id != nil { PresenceService.shared.start() } else { PresenceService.shared.stop() }
                }
                // Complete the Google sign-in callback if iOS routes back via
                // the reversed-client-ID URL scheme (e.g. the Google app path).
                .onOpenURL { url in _ = GIDSignIn.sharedInstance.handle(url) }
        }
    }
}
