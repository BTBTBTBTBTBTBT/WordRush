import UIKit
import SwiftUI
import UserNotifications

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
        return true
    }

    /// A tapped push with a `url` path opens it in-app like a universal link
    /// (anything we don't route just opens the app, as before).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        if let path = response.notification.request.content.userInfo["url"] as? String {
            Task { @MainActor in DeepLink.shared.handle(pushPath: path) }
        }
        completionHandler()
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

enum PushRegistration {
    /// Kick off APNs registration once auth has bootstrapped. Safe to call
    /// repeatedly; iOS coalesces and re-delivers the token when it changes.
    @MainActor
    static func register() {
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
