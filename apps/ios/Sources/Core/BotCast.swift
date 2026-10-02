import Foundation

/// The bot cast (FINISH_SPEC §D1–D2, founder-approved 2026-10-02): the VS bots are
/// the ten Wordocious characters. A ladder of ten rungs (three wins in a row clear
/// a rung), each bot with its own guess range and speed tier, and a Bot of the Day
/// that rotates with the day host. Mirrors the canonical table in packages/core
/// (TypeScript) — same ids, same numbers — so web, iOS and Android agree.
///
/// The old four bots (rook / lexi / nova / adapt) map onto the cast by difficulty
/// so stored ladder progress and stats keep counting.

/// How fast a bot plays (its per-guess pace and slip chance in the bot engine).
public enum BotSpeed: String, Codable, Equatable, CaseIterable {
    case easy, medium, hard, adaptive
}

/// One cast bot.
public struct BotCastMember: Equatable {
    /// Stable id ("rip" … "webster"): ladder ids, opponent ids, progression keys.
    public let id: String
    /// Display name ("Rip").
    public let name: String
    /// The cast character it is drawn as (MascotID raw value: "r", "o1", …).
    public let mascot: String
    /// Ladder position, 1 (easiest) … 10 (the boss).
    public let rung: Int
    public let speed: BotSpeed
    /// The guess range the bot solves in; nil for the adaptive bot (it matches you).
    public let minGuesses: Int?
    public let maxGuesses: Int?
    /// Its personality line ("Easy going", "Bold openers", "The boss" …).
    public let trait: String
    /// The character's accent ("#22c55e").
    public let color: String

    public init(id: String, name: String, mascot: String, rung: Int, speed: BotSpeed,
                minGuesses: Int?, maxGuesses: Int?, trait: String, color: String) {
        self.id = id; self.name = name; self.mascot = mascot; self.rung = rung; self.speed = speed
        self.minGuesses = minGuesses; self.maxGuesses = maxGuesses; self.trait = trait; self.color = color
    }

    public var isAdaptive: Bool { speed == .adaptive }

    /// "Solves in 6", "Solves in 5–6", "Matches your form" (core `botSolveLine`).
    public var solveLine: String {
        guard let lo = minGuesses, let hi = maxGuesses else { return "Matches your form" }
        return lo == hi ? "Solves in \(lo)" : "Solves in \(lo)–\(hi)"
    }
}

public enum BotCast {
    /// The ladder, easiest first (FINISH_SPEC §D1).
    public static let members: [BotCastMember] = [
        BotCastMember(id: "rip", name: "Rip", mascot: "r", rung: 1, speed: .easy, minGuesses: 6, maxGuesses: 6, trait: "Easy going", color: "#22c55e"),
        BotCastMember(id: "ivy", name: "Ivy", mascot: "i", rung: 2, speed: .easy, minGuesses: 5, maxGuesses: 6, trait: "Shy but steady", color: "#10b981"),
        BotCastMember(id: "ollie", name: "Ollie", mascot: "o1", rung: 3, speed: .easy, minGuesses: 5, maxGuesses: 5, trait: "Cheers every guess", color: "#f97316"),
        BotCastMember(id: "opal", name: "Opal", mascot: "o2", rung: 4, speed: .medium, minGuesses: 4, maxGuesses: 5, trait: "A little dramatic", color: "#ec4899"),
        BotCastMember(id: "cosmo", name: "Cosmo", mascot: "c", rung: 5, speed: .medium, minGuesses: 4, maxGuesses: 5, trait: "Bold openers", color: "#0ea5e9"),
        BotCastMember(id: "umi", name: "Umi", mascot: "u", rung: 6, speed: .adaptive, minGuesses: nil, maxGuesses: nil, trait: "Matches your form", color: "#8b5cf6"),
        BotCastMember(id: "ozzy", name: "Ozzy", mascot: "o3", rung: 7, speed: .medium, minGuesses: 4, maxGuesses: 5, trait: "Tricky guesses", color: "#eab308"),
        BotCastMember(id: "dewey", name: "Dewey", mascot: "d", rung: 8, speed: .hard, minGuesses: 3, maxGuesses: 4, trait: "Studies every letter", color: "#2563eb"),
        BotCastMember(id: "scoot", name: "Scoot", mascot: "s", rung: 9, speed: .hard, minGuesses: 2, maxGuesses: 4, trait: "Lightning fast", color: "#ef4444"),
        BotCastMember(id: "webster", name: "Webster", mascot: "w", rung: 10, speed: .hard, minGuesses: 2, maxGuesses: 3, trait: "The boss", color: "#7c3aed"),
    ]

    /// Ladder order (ids).
    public static let ladderIds: [String] = members.map(\.id)

    /// The old bots → the cast rung nearest by difficulty: Rook (easy) → Ivy,
    /// Lexi (medium) → Opal, Nova (hard) → Dewey, Adapt → Umi.
    public static let legacyIds: [String: String] = ["rook": "ivy", "lexi": "opal", "nova": "dewey", "adapt": "umi"]

    /// A cast id for any bot id (old ids map; cast ids, "ghost", "daily" and anything
    /// unknown pass through unchanged — core `canonicalBotId`).
    public static func canonicalId(_ id: String) -> String {
        legacyIds[id] ?? id
    }

    /// The cast bot for an id (old ids map onto the cast); nil for non-cast ids ("ghost", "daily").
    public static func member(_ id: String) -> BotCastMember? {
        let c = canonicalId(id)
        return members.first { $0.id == c }
    }

    /// Old ladder progress (rungs cleared of rook, lexi, nova, adapt: 0–4) → the
    /// cast ladder's rungs cleared: [0, 2, 4, 7, 10][N].
    public static let legacyLadderCleared: [Int] = [0, 2, 4, 7, 10]

    public static func migratedLadderCleared(_ old: Int) -> Int {
        legacyLadderCleared[min(legacyLadderCleared.count - 1, max(0, old))]
    }

    /// The Bot of the Day by weekday, Sunday first (index = JS `getUTCDay()`):
    /// Sun Ozzy (O3), Mon Dewey (D), Tue Ivy (I), Wed Umi (U), Thu Scoot (S),
    /// Fri Opal (O2), Sat Ollie (O1) — each day's Leaderboard host.
    public static let botOfDayByWeekday: [String] = ["ozzy", "dewey", "ivy", "umi", "scoot", "opal", "ollie"]

    /// The Bot of the Day for a weekday index (0 = Sunday … 6 = Saturday).
    public static func botOfDay(weekday: Int) -> BotCastMember {
        let i = ((weekday % 7) + 7) % 7
        return member(botOfDayByWeekday[i])!
    }

    /// The Bot of the Day for a "yyyy-MM-dd" day (the UTC day the Bot of the Day's
    /// seed uses). A malformed day falls back to Sunday's bot (core `botOfTheDay`).
    public static func botOfDay(day: String) -> BotCastMember {
        guard let w = weekday(of: day) else { return botOfDay(weekday: 0) }
        return botOfDay(weekday: w)
    }

    /// 0 = Sunday … 6 = Saturday for a "yyyy-MM-dd" (proleptic Gregorian), nil when malformed.
    public static func weekday(of day: String) -> Int? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        // Sakamoto's method.
        let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
        var y = parts[0]
        let m = parts[1], d = parts[2]
        if m < 3 { y -= 1 }
        return (y + y / 4 - y / 100 + y / 400 + t[m - 1] + d) % 7
    }
}
