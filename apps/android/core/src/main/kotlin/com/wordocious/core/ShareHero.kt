package com.wordocious.core

/**
 * Share cards: the sender's mascot, big and posed by the result (FRIDAY-QUEUE item 46). Port of core share-hero.ts,
 * pinned by share-hero-fixtures.json (web, Swift and Kotlin read the same file). A hero band sits under every card's
 * title: win = cheer + crown, flawless = jump on a gold glow, sweep = cheer + crown, loss = a good-sport shrug (no
 * crown), a leaderboard's rank 1 cheers with the crown, anything else waves. Halloween turns the glow orange.
 */
object ShareHero {
    enum class Result(val id: String) {
        WIN("win"), FLAWLESS("flawless"), SWEEP("sweep"), LOSS("loss"), NEUTRAL("neutral"),
        RANK1("rank1"), RANK2("rank2"), RANK3("rank3"), RANKED("ranked");

        companion object {
            fun of(id: String): Result? = entries.firstOrNull { it.id == id }
        }
    }

    /** [pose] = a living-mascot pose id (AVATAR_POSES); [glow] = "#RRGGBB" behind the mascot. */
    data class Spec(val pose: String, val crown: Boolean, val glow: String, val gold: Boolean)

    const val GLOW_NORMAL = "#A78BFA"
    const val GLOW_GOLD = "#FCD34D"
    const val GLOW_HALLOWEEN = "#FB923C"
    const val GLOW_SPORT = "#94A3B8"
    const val HEIGHT = 300f
    const val GAP = 12f

    fun spec(r: Result, halloween: Boolean): Spec {
        val base = if (halloween) GLOW_HALLOWEEN else GLOW_NORMAL
        return when (r) {
            Result.WIN -> Spec("cheer", true, base, false)
            Result.FLAWLESS -> Spec("jump", true, GLOW_GOLD, true)
            Result.SWEEP -> Spec("cheer", true, base, false)
            Result.LOSS -> Spec("shrug", false, GLOW_SPORT, false)
            Result.RANK1 -> Spec("cheer", true, if (halloween) base else GLOW_GOLD, false)
            Result.RANK2, Result.RANK3 -> Spec("cheer", false, base, false)
            Result.RANKED, Result.NEUTRAL -> Spec("wave", false, base, false)
        }
    }

    fun result(won: Boolean?): Result = when (won) { null -> Result.NEUTRAL; true -> Result.WIN; false -> Result.LOSS }

    fun resultForRank(rank: Int?): Result = when (rank) { 1 -> Result.RANK1; 2 -> Result.RANK2; 3 -> Result.RANK3; else -> Result.RANKED }

    /** Height the band adds to a card (band + gap), 0 when the card has no hero. */
    fun band(hasHero: Boolean): Float = if (hasHero) HEIGHT + GAP else 0f

    /** The frames (width is always 1080): "message" is the long-standing 4:5 .. 9:16 clamp. */
    val frames: Map<String, Pair<Float, Float>> = mapOf(
        "message" to (1350f to 1920f), "story" to (1920f to 1920f), "square" to (1080f to 1080f),
    )
}
