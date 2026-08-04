import SwiftUI
import GoogleSignIn
import Sentry

/// Posted when the app returns to the foreground on a NEW local day: the
/// landing surface resets to Home/Daily exactly like a cold start (founder-
/// approved UX — reopening should never land in Unlimited). RootTabView and
/// HomeView observe. Same-day resumes never post this.
extension Notification.Name {
    static let dayRolledOver = Notification.Name("wordocious.day-rolled-over")
}

@main
struct WordociousApp: App {
    @StateObject private var auth = AuthService.shared
    @StateObject private var themeManager = ThemeManager.shared
    @Environment(\.scenePhase) private var scenePhase
    // APNs token capture (PushRegistration.swift) — SwiftUI apps need a
    // UIApplicationDelegate for didRegisterForRemoteNotifications callbacks.
    @UIApplicationDelegateAdaptor(PushRegistrationDelegate.self) private var pushDelegate
    /// Local day the app was last active — a foreground return on a different
    /// day resets the landing surface to Home/Daily (see scenePhase below).
    @State private var lastActiveDay = LeaderboardService.todayLocal()

    init() {
        // Cold starts always land on the DAILY surface (founder-approved UX):
        // the Pro Daily⇄Unlimited toggle choice is deliberately NOT restored
        // across launches — the founder's sister reopened the app, tapped
        // Classic, and unknowingly played Unlimited, so her daily-leaderboard
        // entry never existed. An in-progress unlimited board is untouched
        // (its save + "unlimited-current-*" marker remain), so toggling back
        // to Unlimited still resumes it.
        UserDefaults.standard.set(PlayMode.daily.rawValue, forKey: "pref-play-mode")
        // Crash reporting for TestFlight/App Store builds only — DEBUG builds
        // (simulator/dev) stay out of Sentry so local crashes don't pollute it.
        #if !DEBUG
        SentrySDK.start { options in
            options.dsn = "https://372e8127de431c710a27250cd00d07df@o4511355315748865.ingest.us.sentry.io/4511779224354816"
            options.tracesSampleRate = 0
            options.enableAutoSessionTracking = true
        }
        #endif
    }

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
                    // Block-list cache so leaderboards can filter immediately.
                    await ModerationService.loadBlockedIds()
                    // APNs token capture (send path comes later with the key).
                    PushRegistration.register()
                }
                // Keep the always-on presence socket alive only while
                // foregrounded + signed in, so the LIVE count reflects real
                // active players (mirrors the web SitePresenceProvider).
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        // Warm resume across local midnight → reset the landing
                        // surface to Home/Daily, same as a cold start. Same-day
                        // resumes change nothing (nobody gets yanked out of a
                        // game they backgrounded five minutes ago).
                        let today = LeaderboardService.todayLocal()
                        if today != lastActiveDay {
                            lastActiveDay = today
                            UserDefaults.standard.set(PlayMode.daily.rawValue, forKey: "pref-play-mode")
                            NotificationCenter.default.post(name: .dayRolledOver, object: nil)
                        }
                        PresenceService.shared.start()
                        // Recompute the daily reminder: if today's 9 dailies are
                        // done (or it's past 18:00) it rolls to tomorrow, so a
                        // finished day never gets tonight's nudge.
                        Task { await NotificationService.reschedule() }
                    } else if phase == .background {
                        // Record the day the app was last ACTIVE: a session that
                        // stays foregrounded across midnight shouldn't reset on
                        // its next brief background/return.
                        lastActiveDay = LeaderboardService.todayLocal()
                        PresenceService.shared.stop()
                    }
                }
                // Every daily completion re-evaluates the reminder — completing
                // the 9th daily flips tonight's reminder to tomorrow 18:00.
                .onDailyCompletion { Task { await NotificationService.reschedule() } }
                .onChange(of: auth.profile?.id) { id in
                    if id != nil { PresenceService.shared.start() } else { PresenceService.shared.stop() }
                }
                // Universal links (wordocious.com/vs/join/*) route in-app;
                // everything else falls through to the Google sign-in callback
                // (reversed-client-ID URL scheme, e.g. the Google app path).
                .onOpenURL { url in
                    if DeepLink.shared.handle(url: url) { return }
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
                // Some launch paths deliver universal links as a browsing
                // NSUserActivity instead of onOpenURL — cover both.
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { _ = DeepLink.shared.handle(url: url) }
                }
        }
    }
}
