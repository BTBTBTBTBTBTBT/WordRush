import Foundation

/// CPU opponent personas + banter for VS-vs-CPU (Pro-only practice).
/// Swift port of apps/web/lib/bot/bot-personas.ts.

enum BotDifficulty: String {
    case easy, medium, hard, adaptive
}

/// Concrete (non-adaptive) skill tier a persona is anchored to.
enum BotTier: String {
    case easy, medium, hard
}

struct BotPersona {
    let id: String
    let name: String
    /// Accent color (hex).
    let color: Int
    let tier: BotTier
    let tagline: String
    /// The founder-picked bot art (asset catalog `bot-<id>`), drawn in a circle
    /// wherever a human avatar would be (VS overhaul §9 — never emoji).
    var art: String { BotPersonas.art(id) }
}

enum BotPersonas {
    static let byTier: [BotTier: BotPersona] = [
        .easy: BotPersona(id: "rook", name: "Rook", color: 0x22C55E, tier: .easy, tagline: "Relaxed — still learning the ropes"),
        .medium: BotPersona(id: "lexi", name: "Lexi", color: 0xF59E0B, tier: .medium, tagline: "Balanced — a fair fight"),
        .hard: BotPersona(id: "nova", name: "Nova", color: 0xEF4444, tier: .hard, tagline: "Ruthless — solves fast, rarely slips"),
    ]

    static func persona(_ tier: BotTier) -> BotPersona { byTier[tier]! }

    /// Asset name for a bot id: rook, lexi, nova, adapt, ghost (anything else → Lexi).
    static func art(_ id: String) -> String {
        ["rook", "lexi", "nova", "adapt", "ghost"].contains(id) ? "bot-\(id)" : "bot-lexi"
    }

    /// The Bot of the Day is Lexi on the shared daily seed — "same bot, same
    /// puzzle for everyone" (VS overhaul §8).
    static var botOfDay: BotPersona { persona(.medium) }

    /// The ladder bot ids (VsLobby.ladderBots) → the kind that plays them.
    static func kind(forBotId id: String) -> CpuKind {
        switch id {
        case "rook": return .easy
        case "nova": return .hard
        case "adapt": return .adaptive
        default: return .medium
        }
    }

    /// A rung / persona's tier line: "Easy", "Medium"… and "Matches you" for Adapt.
    static func tierLabel(forBotId id: String) -> String {
        switch id {
        case "rook": return "Easy"
        case "lexi": return "Medium"
        case "nova": return "Hard"
        case "adapt": return "Matches you"
        case "ghost": return "Your best run"
        default: return "Medium"
        }
    }

    /// "Medium · solves in 4–5" — the tier and the guess range BotEngine plays it at.
    static func tierLine(_ tier: BotTier) -> String {
        let range: String
        switch tier {
        case .easy: range = "5–6"
        case .medium: range = "4–5"
        case .hard: range = "2–4"
        }
        return "\(tierLabel(tier)) · solves in \(range)"
    }

    static func tierLabel(_ tier: BotTier) -> String {
        switch tier {
        case .easy: return "Easy"
        case .medium: return "Medium"
        case .hard: return "Hard"
        }
    }

    enum BotEvent {
        case matchStart, botSolvedBoard, playerOvertakes, playerNearMiss, botWin, botLoss
    }

    private static let banter: [String: [BotEvent: [String]]] = [
        "rook": [
            .matchStart: ["Go easy on me!", "Let’s have fun with this one."],
            .botSolvedBoard: ["Hey, I got one!", "Did I do that right?"],
            .playerOvertakes: ["Wow, you’re quick!", "Teach me your tricks."],
            .playerNearMiss: ["So close!", "You almost had it!"],
            .botWin: ["I actually won one!", "Beginner’s luck, promise."],
            .botLoss: ["Good game — you earned it!", "I’ll get you next time… maybe."],
        ],
        "lexi": [
            .matchStart: ["May the best speller win.", "Warmed up and ready."],
            .botSolvedBoard: ["Locked in.", "One down."],
            .playerOvertakes: ["Nice pace — but I’m right here.", "Not bad. Keep it up."],
            .playerNearMiss: ["Almost. Watch the vowels.", "One tile off."],
            .botWin: ["Balanced, as expected.", "Good match — rematch?"],
            .botLoss: ["Well played, seriously.", "You out-read me that time."],
        ],
        "nova": [
            .matchStart: ["I don’t lose often.", "Let’s make this quick."],
            .botSolvedBoard: ["Solved. Next.", "Too easy."],
            .playerOvertakes: ["Impressive. Briefly.", "Enjoy the lead while it lasts."],
            .playerNearMiss: ["So close. So slow.", "Almost isn’t enough."],
            .botWin: ["As predicted.", "Better luck next run."],
            .botLoss: ["…You’re good. Respect.", "You actually beat me. Again?"],
        ],
    ]

    static func line(_ personaId: String, _ event: BotEvent) -> String? {
        banter[personaId]?[event]?.randomElement()
    }
}
