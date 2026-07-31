import StoreKit
import UIKit

/// App Store review request, asked only at peak moments (a Flawless Victory
/// celebration) and self-throttled to once per 30 days on-device. Apple's own
/// cap (3 shown per 365 days, and never again after the user rates) sits on
/// top — calling this is a REQUEST, not a guarantee, which is why it must ride
/// a moment of genuine delight rather than an app launch.
@MainActor
enum RatingPrompt {
    private static let lastAskedKey = "rating-prompt-last-asked"

    static func maybeAsk() {
        let d = UserDefaults.standard
        let last = d.double(forKey: lastAskedKey)
        guard Date().timeIntervalSince1970 - last > 30 * 86_400 else { return }
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
        d.set(Date().timeIntervalSince1970, forKey: lastAskedKey)
        SKStoreReviewController.requestReview(in: scene)
    }
}
