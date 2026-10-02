import StoreKit
import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// App Store review prompt — FINISH_SPEC §AI (founder 10-02): asked ONLY at a happy
/// moment (right after a Flawless, a Daily Sweep, or a 7-day streak milestone), never
/// in the first 3 days of play, at most once per 120 days, never after a loss
/// (core `ReviewPromptPolicy`). No custom "do you like us?" pre-prompt (Apple 5.6.1):
/// the celebration finishes, then the system prompt is requested.
///
/// The per-game win path still calls `recordWin()` / `maybeAsk()`; those now only
/// note the first day of play (no prompt after an ordinary win).
enum RatingsPrompt {
    private static let firstPlayKey = "ratings-first-play-day"
    private static let lastAskDayKey = "ratings-last-ask-day"

    private static func today() -> String { LeaderboardService.todayLocal() }

    /// Note the first day this device saw the player play.
    static func notePlay() {
        let d = UserDefaults.standard
        if d.string(forKey: firstPlayKey) == nil { d.set(today(), forKey: firstPlayKey) }
    }

    /// Kept for the win paths: records play only.
    static func recordWin() { notePlay() }

    /// Kept for the win paths: an ordinary win is no longer a review moment (§AI).
    @MainActor
    static func maybeAsk() { notePlay() }

    /// §AI: a happy moment (Flawless, Daily Sweep, 7-day streak milestone). Asks the
    /// system prompt after the celebration has had time to land, if the policy allows.
    @MainActor
    static func happyMoment(afterLoss: Bool = false, delay: Double = 3.0) {
        notePlay()
        let d = UserDefaults.standard
        guard ReviewPromptPolicy.shouldAsk(today: today(), firstPlayDay: d.string(forKey: firstPlayKey),
                                           lastAskDay: d.string(forKey: lastAskDayKey), afterLoss: afterLoss) else { return }
        d.set(today(), forKey: lastAskDayKey)
        #if canImport(UIKit)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
            SKStoreReviewController.requestReview(in: scene)
        }
        #endif
    }
}
