package com.wordocious.core

/**
 * The moment shares (FRIDAY-QUEUE item 46): a level-up, a pocket-game result and the streak calendar, three cards that had
 * no share on any platform. Port of apps/web/lib/moment-share.ts (pinned by moment-share-fixtures.json). Pure: the card
 * drawing (app MomentShare) turns one of these into the shared hero-band layout. Every line is a complete sentence.
 */
object MomentShare {
    enum class Kind(val id: String) { LEVEL_UP("levelUp"), POCKET("pocket"), STREAK("streak") }

    data class Moment(
        val kind: Kind,
        /** The lettered headline: always the full name. */
        val title: String,
        /** "#rrggbb" accent. */
        val accentHex: String,
        /** The hero number ("12", "2-1", "7"). */
        val big: String,
        /** Under it ("Level", "Final score", "Day streak"). */
        val bigLabel: String,
        /** Up to three complete lines. */
        val lines: List<String>,
        /** The streak calendar: the last seven days, oldest first, true = played; empty = none. */
        val dots: List<Boolean> = emptyList(),
        /** A pocket game's result (drives the hero's pose); null = a draw / not a game. */
        val won: Boolean? = null,
    ) {
        /** The hero pose group: a streak celebrates gold, a level-up cheers, a pocket game follows the result. */
        val heroResult: ShareHero.Result
            get() = when (kind) {
                Kind.POCKET -> ShareHero.result(won)
                Kind.STREAK -> ShareHero.Result.FLAWLESS
                Kind.LEVEL_UP -> ShareHero.Result.WIN
            }
    }

    const val PURPLE = "#7c3aed"
    const val GOLD = "#f59e0b"

    private fun grouped(n: Int): String = String.format(java.util.Locale.US, "%,d", n)

    /** "LEVEL UP!": the new level, its tier and what it takes to the next one. */
    fun levelUp(level: Int, tierLabel: String, accentHex: String = PURPLE, xpToNext: Int? = null): Moment {
        val lines = mutableListOf("$tierLabel tier")
        if (xpToNext != null && xpToNext > 0) lines += "${grouped(xpToNext)} XP to level ${level + 1}"
        return Moment(Kind.LEVEL_UP, "LEVEL UP!", accentHex, level.toString(), "Level", lines)
    }

    /** A finished pocket game: the title, the final score (sender first) and who it was against. */
    fun pocketResult(gameTitle: String, won: Boolean?, mine: Int?, theirs: Int?, opponent: String, accentHex: String = PURPLE): Moment {
        val score = if (mine != null && theirs != null) "$mine–$theirs" else when (won) { true -> "WIN"; false -> "LOSS"; null -> "DRAW" }
        val verdict = when (won) { true -> "I beat $opponent"; false -> "Good game, $opponent"; null -> "A draw with $opponent" }
        return Moment(Kind.POCKET, gameTitle.uppercase(), accentHex, score, "Final score", listOf(verdict, "Play me on Wordocious"), won = won)
    }

    /** The streak calendar: the streak, the best, and the last seven days as dots (oldest first). */
    fun streak(streak: Int, best: Int, lastDays: List<Boolean>, accentHex: String = GOLD): Moment {
        val lines = mutableListOf(if (streak == 1) "One day down" else "$streak days in a row")
        if (best > 0) lines += if (streak >= best) "A new personal best" else "Best: $best days"
        return Moment(Kind.STREAK, "ON A STREAK", accentHex, streak.toString(), "Day streak", lines, dots = lastDays.takeLast(7))
    }
}
