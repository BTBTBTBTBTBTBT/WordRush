import Foundation

/// The moment shares (FRIDAY-QUEUE item 46): a level-up, a pocket-game result and the streak calendar, three cards that
/// had no share on any platform. Port of apps/web/lib/moment-share.ts, pinned by moment-share-fixtures.json (web, Swift and
/// Kotlin produce the same card from the same arguments). Pure: the card view turns one of these into the shared hero-band
/// layout. Every line is a complete sentence, never cut.
public enum MomentShare {
    public enum Kind: String, Equatable, Sendable { case levelUp, pocket, streak }

    public struct Moment: Equatable, Sendable {
        public let kind: Kind
        /// The lettered headline: always the full name.
        public let title: String
        /// "#rrggbb".
        public let accentHex: String
        /// The hero number ("12", "2-1", "7").
        public let big: String
        /// Under it ("Level", "Final score", "Day streak").
        public let bigLabel: String
        /// Up to three complete lines.
        public let lines: [String]
        /// The streak calendar: the last seven days, oldest first, true = played; empty = none.
        public let dots: [Bool]
        /// A pocket game's result (drives the hero's pose); nil = a draw / not a game.
        public let won: Bool?

        /// The hero pose group: a streak celebrates gold, a level-up cheers, a pocket game follows the result.
        public var hero: ShareHero.Result {
            switch kind {
            case .pocket: return ShareHero.result(won: won)
            case .streak: return .flawless
            case .levelUp: return .win
            }
        }
    }

    public static let purple = "#7c3aed"
    public static let gold = "#f59e0b"

    private static func grouped(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    /// "LEVEL UP!": the new level, its tier and what it takes to the next one.
    public static func levelUp(level: Int, tier: String, accentHex: String = purple, xpToNext: Int? = nil) -> Moment {
        var lines = ["\(tier) tier"]
        if let xp = xpToNext, xp > 0 { lines.append("\(grouped(xp)) XP to level \(level + 1)") }
        return Moment(kind: .levelUp, title: "LEVEL UP!", accentHex: accentHex, big: String(level), bigLabel: "Level",
                      lines: lines, dots: [], won: nil)
    }

    /// A finished pocket game: the title, the final score (sender first) and who it was against.
    public static func pocketResult(gameTitle: String, won: Bool?, mine: Int?, theirs: Int?, opponent: String,
                                    accentHex: String = purple) -> Moment {
        let score: String
        if let mine, let theirs { score = "\(mine)\u{2013}\(theirs)" } else { score = won == true ? "WIN" : won == false ? "LOSS" : "DRAW" }
        let verdict = won == true ? "I beat \(opponent)" : won == false ? "Good game, \(opponent)" : "A draw with \(opponent)"
        return Moment(kind: .pocket, title: gameTitle.uppercased(), accentHex: accentHex, big: score, bigLabel: "Final score",
                      lines: [verdict, "Play me on Wordocious"], dots: [], won: won)
    }

    /// The streak calendar: the streak, the best, and the last seven days as dots (oldest first).
    public static func streak(_ streak: Int, best: Int, lastDays: [Bool], accentHex: String = gold) -> Moment {
        var lines = [streak == 1 ? "One day down" : "\(streak) days in a row"]
        if best > 0 { lines.append(streak >= best ? "A new personal best" : "Best: \(best) days") }
        return Moment(kind: .streak, title: "ON A STREAK", accentHex: accentHex, big: String(streak), bigLabel: "Day streak",
                      lines: lines, dots: Array(lastDays.suffix(7)), won: nil)
    }
}
