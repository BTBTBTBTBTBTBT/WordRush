import StoreKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// App Store review prompt with deliberate timing: only after a WIN while the
/// player is on a streak of 3+, at most once per app version, delayed a beat so
/// it never competes with the confetti. Never fires on a loss or at launch —
/// asking at a high point is worth real stars.
enum ReviewPrompter {
    @MainActor
    static func maybeAskAfterWin() {
        guard (AuthService.shared.profile?.currentStreak ?? 0) >= 3 else { return }
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        let key = "review-asked-v\(version)"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        #if canImport(UIKit)
        // Let the win celebration land first.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            guard let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
            SKStoreReviewController.requestReview(in: scene)
        }
        #endif
    }
}
