package com.wordocious.app.data

/**
 * CPU opponent personas + banter for VS-vs-CPU (Pro-only practice).
 * Kotlin port of apps/web/lib/bot/bot-personas.ts.
 */

enum class BotDifficulty { EASY, MEDIUM, HARD, ADAPTIVE }

/** Concrete (non-adaptive) skill tier a persona is anchored to. */
enum class BotTier { EASY, MEDIUM, HARD }

data class BotPersona(
    val id: String,
    val name: String,
    val avatar: String,   // robot emoji
    val color: Long,      // 0xFFRRGGBB
    val tier: BotTier,
    val tagline: String,
)

object BotPersonas {
    val byTier: Map<BotTier, BotPersona> = mapOf(
        BotTier.EASY to BotPersona("rook", "Rook", "🤖", 0xFF22C55E, BotTier.EASY, "Relaxed — still learning the ropes"),
        BotTier.MEDIUM to BotPersona("lexi", "Lexi", "🧠", 0xFFF59E0B, BotTier.MEDIUM, "Balanced — a fair fight"),
        BotTier.HARD to BotPersona("nova", "Nova", "⚡", 0xFFEF4444, BotTier.HARD, "Ruthless — solves fast, rarely slips"),
    )

    fun persona(tier: BotTier): BotPersona = byTier.getValue(tier)

    fun tierLabel(tier: BotTier): String = when (tier) {
        BotTier.EASY -> "Easy"; BotTier.MEDIUM -> "Medium"; BotTier.HARD -> "Hard"
    }

    enum class BotEvent { MATCH_START, BOT_SOLVED_BOARD, PLAYER_OVERTAKES, PLAYER_NEAR_MISS, BOT_WIN, BOT_LOSS }

    private val banter: Map<String, Map<BotEvent, List<String>>> = mapOf(
        "rook" to mapOf(
            BotEvent.MATCH_START to listOf("Go easy on me!", "Let’s have fun with this one."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Hey, I got one!", "Did I do that right?"),
            BotEvent.PLAYER_OVERTAKES to listOf("Wow, you’re quick!", "Teach me your tricks."),
            BotEvent.BOT_WIN to listOf("I actually won one!", "Beginner’s luck, promise."),
            BotEvent.BOT_LOSS to listOf("Good game — you earned it!", "I’ll get you next time… maybe."),
        ),
        "lexi" to mapOf(
            BotEvent.MATCH_START to listOf("May the best speller win.", "Warmed up and ready."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Locked in.", "One down."),
            BotEvent.PLAYER_OVERTAKES to listOf("Nice pace — but I’m right here.", "Not bad. Keep it up."),
            BotEvent.BOT_WIN to listOf("Balanced, as expected.", "Good match — rematch?"),
            BotEvent.BOT_LOSS to listOf("Well played, seriously.", "You out-read me that time."),
        ),
        "nova" to mapOf(
            BotEvent.MATCH_START to listOf("I don’t lose often.", "Let’s make this quick."),
            BotEvent.BOT_SOLVED_BOARD to listOf("Solved. Next.", "Too easy."),
            BotEvent.PLAYER_OVERTAKES to listOf("Impressive. Briefly.", "Enjoy the lead while it lasts."),
            BotEvent.BOT_WIN to listOf("As predicted.", "Better luck next run."),
            BotEvent.BOT_LOSS to listOf("…You’re good. Respect.", "You actually beat me. Again?"),
        ),
    )

    fun line(personaId: String, event: BotEvent): String? =
        banter[personaId]?.get(event)?.randomOrNull()
}
