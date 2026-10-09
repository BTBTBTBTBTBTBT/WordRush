import UIKit
import SwiftUI
import UserNotifications
import WordociousCore

/// APNs device-token capture (groundwork for remote push / lifecycle
/// messaging). Registration + storage only: tokens land in the
/// device_tokens table keyed to the signed-in user. The SERVER send path is
/// deliberately deferred — it needs an APNs auth key (.p8) from the
/// developer portal wired into the backend before anything can be sent.
/// Local scheduled reminders (NotificationService) are unaffected.
final class PushRegistrationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Route push taps (VS challenges carry `url: /vs/challenge/<code>`, the
        // "someone's looking" ping `url: /vs/live/<MODE>`).
        UNUserNotificationCenter.current().delegate = self
        PushActions.register()   // item 34: the long-press card's Play / Later actions
        #if DEBUG
        PerfTour.bootIfRequested()   // FINISH_SPEC BJ3: `-perfTour` (docs/PERF_HARNESS.md)
        StoreDemo.bootIfRequested()  // `-storeDemo`: canned signed-in world for store screenshots
        #endif
        return true
    }

    /// A tapped push with a `url` path opens it in-app like a universal link
    /// (anything we don't route just opens the app, as before).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // Item 34: "Later" on the long-press card just dismisses; Play and a plain tap open the exact game.
        if response.actionIdentifier == PushRich.actionLater {
            completionHandler()
            return
        }
        if let path = response.notification.request.content.userInfo["url"] as? String {
            Task { @MainActor in DeepLink.shared.handle(pushPath: path) }
        }
        completionHandler()
    }

    /// FINISH_SPEC §K1: a push that arrives while the app is open shows as the
    /// in-app notice card (tinted, a cast pose, a candy action) instead of nothing.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let content = notification.request.content
        let notice = InAppNotice(title: content.title, body: content.body, url: content.userInfo["url"] as? String)
        if !notice.title.isEmpty || !notice.body.isEmpty {
            Task { @MainActor in InAppNoticeCenter.shared.show(notice) }
        }
        completionHandler([])
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await PushRegistration.upload(token: token) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Simulators and denied-permission devices land here — non-fatal.
    }
}

/// Item 34: the notification category the content extension (the long-press card) shows its Play / Later
/// actions for. Registered at every launch (the category set replaces, never accumulates).
enum PushActions {
    static func register() {
        let play = UNNotificationAction(identifier: PushRich.actionPlay, title: "Play", options: [.foreground])
        let later = UNNotificationAction(identifier: PushRich.actionLater, title: "Later", options: [])
        let rich = UNNotificationCategory(identifier: PushRich.category, actions: [play, later],
                                          intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().getNotificationCategories { existing in
            var all = existing.filter { $0.identifier != PushRich.category }
            all.insert(rich)
            UNUserNotificationCenter.current().setNotificationCategories(all)
        }
    }
}

enum PushRegistration {
    /// Kick off APNs registration once auth has bootstrapped. Safe to call
    /// repeatedly; iOS coalesces and re-delivers the token when it changes.
    @MainActor
    static func register() {
        // 13+ age check (item 29): no push registration before the check passes.
        guard AgeCheckStore.shared.isCleared else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    static func upload(token: String) async {
        guard let userId = await MainActor.run(body: { AuthService.shared.profile?.id }) else { return }
        struct Row: Encodable {
            let user_id: String
            let platform: String
            let token: String
        }
        _ = try? await AuthService.shared.client
            .from("device_tokens")
            .upsert(Row(user_id: userId, platform: "ios", token: token), onConflict: "token")
            .execute()
    }
}
