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
    /// Robot avatar emoji, rendered where a human avatar would be.
    let avatar: String
    /// Accent color (hex).
    let color: Int
    let tier: BotTier
    let tagline: String
}

enum BotPersonas {
    static let byTier: [BotTier: BotPersona] = [
        .easy: BotPersona(id: "rook", name: "Rook", avatar: "🤖", color: 0x22C55E, tier: .easy, tagline: "Relaxed — still learning the ropes"),
        .medium: BotPersona(id: "lexi", name: "Lexi", avatar: "🧠", color: 0xF59E0B, tier: .medium, tagline: "Balanced — a fair fight"),
        .hard: BotPersona(id: "nova", name: "Nova", avatar: "⚡", color: 0xEF4444, tier: .hard, tagline: "Ruthless — solves fast, rarely slips"),
    ]

    static func persona(_ tier: BotTier) -> BotPersona { byTier[tier]! }

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
