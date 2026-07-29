import UIKit
import SwiftUI

/// APNs device-token capture (groundwork for remote push / lifecycle
/// messaging). Registration + storage only: tokens land in the
/// device_tokens table keyed to the signed-in user. The SERVER send path is
/// deliberately deferred — it needs an APNs auth key (.p8) from the
/// developer portal wired into the backend before anything can be sent.
/// Local scheduled reminders (NotificationService) are unaffected.
final class PushRegistrationDelegate: NSObject, UIApplicationDelegate {
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
