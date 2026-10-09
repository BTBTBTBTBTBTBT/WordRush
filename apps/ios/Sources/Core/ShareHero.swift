import Foundation

/// Share cards: the sender's mascot, big and posed by the result (FRIDAY-QUEUE item 46). Port of core share-hero.ts,
/// pinned by share-hero-fixtures.json (web, Swift and Kotlin read the same file). A hero band sits under every card's
/// title: win = cheer + crown, flawless = jump on a gold glow, sweep = cheer + crown, loss = a good-sport shrug (no
/// crown), a leaderboard's rank 1 cheers with the crown, anything else waves. Halloween turns the glow orange.
public enum ShareHero {
    public enum Result: String, CaseIterable, Sendable {
        case win, flawless, sweep, loss, neutral, rank1, rank2, rank3, ranked
    }

    public struct Spec: Equatable, Sendable {
        /// A living-mascot pose id (AVATAR_POSES).
        public let pose: String
        public let crown: Bool
        /// "#RRGGBB" glow behind the mascot.
        public let glow: String
        public let gold: Bool
    }

    public static let glowNormal = "#A78BFA", glowGold = "#FCD34D", glowHalloween = "#FB923C", glowSport = "#94A3B8"
    public static let height: Double = 300
    public static let gap: Double = 12

    public static func spec(_ r: Result, halloween: Bool) -> Spec {
        let base = halloween ? glowHalloween : glowNormal
        switch r {
        case .win: return Spec(pose: "cheer", crown: true, glow: base, gold: false)
        case .flawless: return Spec(pose: "jump", crown: true, glow: glowGold, gold: true)
        case .sweep: return Spec(pose: "cheer", crown: true, glow: base, gold: false)
        case .loss: return Spec(pose: "shrug", crown: false, glow: glowSport, gold: false)
        case .rank1: return Spec(pose: "cheer", crown: true, glow: halloween ? base : glowGold, gold: false)
        case .rank2, .rank3: return Spec(pose: "cheer", crown: false, glow: base, gold: false)
        case .ranked, .neutral: return Spec(pose: "wave", crown: false, glow: base, gold: false)
        }
    }

    public static func result(won: Bool?) -> Result {
        guard let won else { return .neutral }
        return won ? .win : .loss
    }

    public static func result(rank: Int?) -> Result {
        switch rank { case 1: return .rank1; case 2: return .rank2; case 3: return .rank3; default: return .ranked }
    }

    /// Height the band adds to a card (band + gap), 0 when the card has no hero.
    public static func band(hasHero: Bool) -> Double { hasHero ? height + gap : 0 }

    /// The frames (width is always 1080): 'message' is the long-standing 4:5 .. 9:16 clamp.
    public static let frames: [String: (minH: Double, maxH: Double)] = [
        "message": (1350, 1920), "story": (1920, 1920), "square": (1080, 1080),
    ]
}
