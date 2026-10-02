import Foundation

/// The old Flawless-only review request, now the shared §AI happy-moment policy.
@MainActor
enum RatingPrompt {
    static func maybeAsk() { RatingsPrompt.happyMoment(delay: 0.5) }
}
