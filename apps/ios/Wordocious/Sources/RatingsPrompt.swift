import StoreKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// App Store review prompt (ASO lever), asked only at a high point and heavily
/// throttled so it stays App Review-safe and never nags:
///   (a) lifetime WIN count >= 5 (recordWin() increments the counter),
///   (b) at least 14 days since the last ask,
///   (c) never more than once per build (CFBundleVersion).
/// Callers invoke recordWin() + maybeAsk() from the post-game WIN path only —
/// never on a loss, never at launch. maybeAsk() waits ~2s so the system alert
/// doesn't collide with the confetti / XP toast.
///
/// Replaces the earlier ReviewPrompter (streak >= 3, once per marketing
/// version) — one review prompt policy, not two competing ones.
enum RatingsPrompt {
    private static let winCountKey = "ratings-win-count"
    private static let lastAskKey = "ratings-last-ask"
    private static let minWins = 5
    private static let minDaysBetweenAsks = 14.0

    /// Count a WON game (call once per won game, from the win path only).
    static func recordWin() {
        let d = UserDefaults.standard
        d.set(d.integer(forKey: winCountKey) + 1, forKey: winCountKey)
    }

    @MainActor
    static func maybeAsk() {
        let d = UserDefaults.standard

        // (a) Lifetime wins.
        guard d.integer(forKey: winCountKey) >= minWins else { return }

        // (b) 14-day cooldown between asks.
        if let last = d.object(forKey: lastAskKey) as? Date,
           Date().timeIntervalSince(last) < minDaysBetweenAsks * 86_400 { return }

        // (c) Once per build.
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        let buildKey = "ratings-asked-b\(build)"
        guard !d.bool(forKey: buildKey) else { return }

        d.set(true, forKey: buildKey)
        d.set(Date(), forKey: lastAskKey)

        #if canImport(UIKit)
        // Let the win celebration (confetti / XP toast) land first.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            guard let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
            SKStoreReviewController.requestReview(in: scene)
        }
        #endif
    }
}
