import Foundation
import WordociousCore

/// CPU opponents for VS-vs-CPU (Pro-only practice). FINISH_SPEC §D1 (founder,
/// 2026-10-02): the bots ARE the cast — a ladder of ten characters (core
/// `BotCast`, mirrored from packages/core), each drawn as its own character and
/// talking in its own (always kind) voice. The old four (Rook / Lexi / Nova /
/// Adapt) map onto the cast by difficulty, so stored ids keep resolving.

enum BotDifficulty: String {
    case easy, medium, hard, adaptive
}

/// Concrete (non-adaptive) skill tier a persona is anchored to (the bot engine's pace).
enum BotTier: String {
    case easy, medium, hard
}

struct BotPersona {
    /// The cast id ("rip" … "webster").
    let id: String
    let name: String
    /// The character it is drawn as.
    let mascot: MascotID
    /// Accent color (hex) — the character's own color.
    let color: Int
    let tier: BotTier
    /// Ladder rung 1…10.
    let rung: Int
    let tagline: String
    let member: BotCastMember

    /// The bot's avatar art: its character (`mascot-<id>`), never an emoji.
    var art: String { mascot.assetName }
    /// "Easy going · Solves in 6", "Matches your form" (Umi).
    var tierLine: String { member.isAdaptive ? member.solveLine : "\(member.trait) · \(member.solveLine)" }
    var isAdaptive: Bool { member.isAdaptive }
}

enum BotPersonas {
    /// Each character's longer tagline (the color comes from the core cast table).
    private static let taglines: [String: String] = [
        "rip": "Sleepy, sweet, and in no hurry",
        "ivy": "Shy, but sneakily good",
        "ollie": "Your biggest cheerleader",
        "opal": "A star on any stage",
        "cosmo": "Curious, with bold openers",
        "umi": "Calm — plays at your level",
        "ozzy": "A prankster with tricky guesses",
        "dewey": "Big brain, full notebook",
        "scoot": "Fast. Really fast.",
        "webster": "The boss of Wordocious",
    ]

    private static func tier(_ speed: BotSpeed) -> BotTier {
        switch speed {
        case .easy: return .easy
        case .medium, .adaptive: return .medium
        case .hard: return .hard
        }
    }

    private static func make(_ m: BotCastMember) -> BotPersona {
        let color = Int(m.color.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x7C3AED
        return BotPersona(id: m.id, name: m.name, mascot: MascotID(rawValue: m.mascot) ?? .w, color: color,
                          tier: tier(m.speed), rung: m.rung, tagline: taglines[m.id] ?? m.trait, member: m)
    }

    /// The whole ladder, easiest first.
    static let cast: [BotPersona] = BotCast.members.map(make)

    /// The persona for any bot id — a cast id or an old id (rook → Ivy, lexi → Opal,
    /// nova → Dewey, adapt → Umi); unknown ids fall back to Opal.
    static func persona(_ id: String) -> BotPersona {
        let c = BotCast.canonicalId(id)
        return cast.first { $0.id == c } ?? cast[3]
    }

    /// The old tier anchors (callers that only know a tier): easy → Ivy, medium → Opal, hard → Dewey.
    static func persona(_ tier: BotTier) -> BotPersona {
        switch tier {
        case .easy: return persona("ivy")
        case .medium: return persona("opal")
        case .hard: return persona("dewey")
        }
    }

    /// Avatar art for a bot id: the cast character's hero image; "ghost" keeps its
    /// own art (Your Ghost is the player's best run — VS screens draw it as the
    /// player's faded letter tile where they can).
    static func art(_ id: String) -> String {
        if id == "ghost" { return "bot-ghost" }
        return persona(id).art
    }

    /// The character a bot id is drawn as (ghost → nil).
    static func mascot(_ id: String) -> MascotID? {
        id == "ghost" ? nil : persona(id).mascot
    }

    /// Today's Bot of the Day (UTC day, the day its seed uses), rotating with the
    /// day host (§D2: Mon Dewey · Tue Ivy · Wed Umi · Thu Scoot · Fri Opal · Sat Ollie · Sun Ozzy).
    static var botOfDay: BotPersona { botOfDay(utcDay: LeaderboardService.todayUTC()) }

    static func botOfDay(utcDay: String) -> BotPersona { persona(BotCast.botOfDay(day: utcDay).id) }

    /// A ladder / bot id → the CPU kind that plays it.
    static func kind(forBotId id: String) -> CpuKind {
        CpuKind(rawValue: BotCast.canonicalId(id)) ?? .opal
    }

    /// A rung / persona's trait: "Easy going", "The boss", "Matches your form"… ("Your best run" for the ghost).
    static func tierLabel(forBotId id: String) -> String {
        id == "ghost" ? "Your best run" : persona(id).member.trait
    }

    /// "Easy going · Solves in 6" for a bot id.
    static func tierLine(forBotId id: String) -> String { persona(id).tierLine }

    static func tierLabel(_ tier: BotTier) -> String {
        switch tier {
        case .easy: return "Easy"
        case .medium: return "Medium"
        case .hard: return "Hard"
        }
    }

    // MARK: Banter (kind, in character)

    enum BotEvent {
        case matchStart, botSolvedBoard, playerOvertakes, playerNearMiss, botWin, botLoss
    }

    private static let banter: [String: [BotEvent: [String]]] = [
        "rip": [
            .matchStart: ["*yawn* Oh! Is it go time?", "Let’s take it nice and easy."],
            .botSolvedBoard: ["Oh hey, I got one!", "Woke up just in time for that."],
            .playerOvertakes: ["Wow, you’re wide awake!", "You’re zooming. I love it."],
            .playerNearMiss: ["Ooh, so close!", "Almost! You’ve got this."],
            .botWin: ["I won? Best nap ever.", "Lucky dream, I promise."],
            .botLoss: ["Great game! Time for a nap.", "You earned that one. Sweet dreams."],
        ],
        "ivy": [
            .matchStart: ["Um… hi. Good luck!", "I’ll try my best. You too!"],
            .botSolvedBoard: ["Oh! I got it.", "One down… quietly."],
            .playerOvertakes: ["You’re so good at this.", "Wow, nice pace!"],
            .playerNearMiss: ["So close! Next one’s yours.", "Almost had it!"],
            .botWin: ["Oh my, I won! Thank you for the game.", "That was fun. Rematch?"],
            .botLoss: ["Well played! You’re amazing.", "That was lovely. Again sometime?"],
        ],
        "ollie": [
            .matchStart: ["Go, go, go! Let’s have fun!", "Ready? I’m cheering for both of us!"],
            .botSolvedBoard: ["Woo! Got one!", "Cartwheel! One down!"],
            .playerOvertakes: ["Yes! Look at you go!", "That’s the spirit!"],
            .playerNearMiss: ["Ooh, so close! Keep going!", "Almost! I believe in you!"],
            .botWin: ["Victory dance! Great game, friend!", "We both played great!"],
            .botLoss: ["You did it! Pom-poms up for you!", "What a win! Give me four high fives!"],
        ],
        "opal": [
            .matchStart: ["Lights up — let’s put on a show!", "Ready for your close-up?"],
            .botSolvedBoard: ["And… scene. One down.", "A star moment!"],
            .playerOvertakes: ["Ooh, you’re stealing the spotlight!", "Now that’s a performance."],
            .playerNearMiss: ["So close — encore!", "Almost a standing ovation."],
            .botWin: ["Take a bow with me. Great game!", "What a show! Rematch?"],
            .botLoss: ["Bravo! The spotlight’s yours.", "Standing ovation for you!"],
        ],
        "cosmo": [
            .matchStart: ["Let’s explore this one together!", "New puzzle, new adventure!"],
            .botSolvedBoard: ["Found it! Mapped that one out.", "Discovery! One down."],
            .playerOvertakes: ["Ooh, which way did you go?", "Nice route! You’re ahead."],
            .playerNearMiss: ["So close — you’re on the trail!", "Almost there, explorer!"],
            .botWin: ["Adventure complete! Good game.", "What a trip! Rematch?"],
            .botLoss: ["You found the way first. Well played!", "Great exploring! Teach me that route."],
        ],
        "umi": [
            .matchStart: ["Breathe in… let’s play.", "Calm minds, clear guesses."],
            .botSolvedBoard: ["Flowing nicely. One down.", "Peaceful. Solved."],
            .playerOvertakes: ["Lovely focus. Keep flowing.", "You’re in the zone."],
            .playerNearMiss: ["So close. Breathe, and go again.", "Almost. Trust yourself."],
            .botWin: ["A balanced game. Thank you.", "Good energy. Again sometime?"],
            .botLoss: ["Beautifully played.", "Your focus was wonderful. Well done."],
        ],
        "ozzy": [
            .matchStart: ["Heh — ready for a few surprises?", "I’ve got tricks up my sleeve!"],
            .botSolvedBoard: ["Ta-da! Didn’t see that coming?", "Sneaky solve!"],
            .playerOvertakes: ["Hey, that’s my trick!", "Ooh, you’re sneaky too!"],
            .playerNearMiss: ["Ha, so close! Nice try.", "Almost fooled the puzzle!"],
            .botWin: ["Gotcha! All in good fun. Great game!", "Surprise! Rematch?"],
            .botLoss: ["You out-tricked the trickster!", "Well played — you saw right through me."],
        ],
        "dewey": [
            .matchStart: ["Notebook open. Let’s think it through.", "Hypothesis: this will be fun."],
            .botSolvedBoard: ["Elementary. One down.", "Noted and solved."],
            .playerOvertakes: ["Fascinating — great deduction!", "You’re ahead. Impressive logic."],
            .playerNearMiss: ["So close — one letter to check.", "Almost! Your method is sound."],
            .botWin: ["The numbers worked out. Great game!", "Good thinking all around. Rematch?"],
            .botLoss: ["Brilliant solving! I’m taking notes.", "Well reasoned — you earned it."],
        ],
        "scoot": [
            .matchStart: ["On your marks… go go go!", "Ready, set, zoom!"],
            .botSolvedBoard: ["Zoom! Got one!", "Speed run! One down!"],
            .playerOvertakes: ["Whoa, you’re fast!", "Hey, you passed me! Nice!"],
            .playerNearMiss: ["So close! Sprint it home!", "Almost at the finish line!"],
            .botWin: ["Photo finish! Great race!", "What a sprint! Again?"],
            .botLoss: ["You beat me to the line! Awesome!", "Fastest fingers around. Well done!"],
        ],
        "webster": [
            .matchStart: ["Welcome to the top. Let’s have a great game!", "The boss is in. Good luck!"],
            .botSolvedBoard: ["One down — keep up if you can!", "Solved. Your move, champ."],
            .playerOvertakes: ["Now THAT is boss-level play!", "Look at you climbing!"],
            .playerNearMiss: ["So close — you’re ready for this!", "Almost! You’ve got the moves."],
            .botWin: ["Great match! You’ll get me soon.", "That was fun. Rematch?"],
            .botLoss: ["You beat the boss! Proud of you!", "New champion! Brilliant game."],
        ],
    ]

    /// A random line for a bot id (old ids map onto the cast); nil for the ghost.
    static func line(_ botId: String, _ event: BotEvent) -> String? {
        guard botId != "ghost" else { return nil }
        return banter[persona(botId).id]?[event]?.randomElement()
    }
}
