package com.wordocious.app.data

import com.wordocious.app.ModeGen
import com.wordocious.app.ui.formatGuessStat

/**
 * FINISH_SPEC BJ12 (founder 10-03): every game reaches Stats and Friends
 * Moments. Port of packages/core/src/mode-coverage.ts, pinned by
 * mode-coverage-fixtures.json (ModeCoverageFixtureTest). The gap that prompted
 * it: MedalService's Perfect `when` named only the nine word modes, so no More
 * Games puzzle ever earned a Perfect medal (or its Moment) on Android.
 */
object ModeCoverage {
    /**
     * Does a finished solo daily earn the Perfect medal? The word modes keep
     * their explicit rule; every More Games title (group "more", so a new puzzle
     * is covered with no code change) is perfect at the catalog's guessBase with
     * every board solved.
     */
    fun isPerfectDailyResult(
        gameMode: String, group: String?, guessBase: Int,
        guessCount: Int, boardsSolved: Int, totalBoards: Int, completed: Boolean,
    ): Boolean {
        if (!completed) return false
        return when (gameMode) {
            "DUEL", "PROPERNOUNDLE", "DUEL_6", "DUEL_7" -> guessCount == 1
            "QUORDLE", "SEQUENCE", "RESCUE" -> boardsSolved == 4 && guessCount <= 4
            "OCTORDLE" -> boardsSolved == 8 && guessCount <= 8
            "GAUNTLET" -> boardsSolved == 21
            else -> group == "more" && guessCount in 1..guessBase && boardsSolved >= totalBoards
        }
    }

    /** The catalog-driven rule for a db key (MedalService's entry point). */
    fun isPerfectDailyResult(gameMode: String, guessCount: Int, boardsSolved: Int, totalBoards: Int, completed: Boolean): Boolean {
        val meta = ModeGen.byDbKey(gameMode)
        return isPerfectDailyResult(gameMode, meta?.group, meta?.guessBase ?: 1, guessCount, boardsSolved, totalBoards, completed)
    }

    private val NUMBER_WORDS = listOf(
        "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
    )

    /** "ten" for 10 — the Moments copy spells small counts out. */
    fun countWord(n: Int): String = if (n in NUMBER_WORDS.indices) NUMBER_WORDS[n] else n.toString()

    /** The More Games dailies a More Games Sweep covers (the feed route counts the same set). */
    val moreSweepKeys: List<String>
        get() = ModeGen.all.filter { it.enabled && it.group == "more" && it.dailyEligible && it.dbKey != null }.mapNotNull { it.dbKey }

    /** The More Games Sweep moment; the count comes from the catalog (it was a literal "ten"). */
    fun moreSweepMomentText(who: String, flawless: Boolean, total: Int): String =
        if (flawless) "$who — Flawless More Games, all ${countWord(total)} won"
        else "$who — More Games Sweep, all ${countWord(total)} played"

    /** A record moment's label: the fewest record reads through the mode ("Fewest Mistakes" for Sudocious). */
    fun recordMomentLabel(recordType: String, semantics: String?): String = when (recordType) {
        "fastest_win" -> "Fastest Win"
        "fewest_guesses" -> ModeStats.fewestRecordLabel(semantics ?: "guesses")
        "longest_streak" -> "Longest Win Streak"
        "most_games_played" -> "Most Games Played"
        else -> recordType
    }

    /** A record's value: the RECORD_LABELS formats, "fewest_guesses" through the mode ("1 guess", "0 mistakes", "Par"). */
    fun recordValueText(recordType: String, value: Int, semantics: String?, guessBase: Int): String = when (recordType) {
        "fastest_win" -> if (value < 60) "${value}s" else "${value / 60}m ${value % 60}s"
        "fewest_guesses" -> formatGuessStat(semantics ?: "guesses", guessBase, value)
        "most_games_played" -> "$value games"
        "longest_streak" -> "$value wins"
        "most_gold_medals" -> "$value golds"
        "highest_level" -> "Level $value"
        "most_daily_completions" -> "$value dailies"
        else -> value.toString()
    }

    /** The Moments headline for a medal or record — identical on every platform. */
    fun modeMomentHeadline(
        type: String, me: Boolean, username: String, kind: String?,
        gameMode: String?, gameTitle: String?, semantics: String?, valueText: String?,
    ): String {
        val who = if (me) "You" else username
        val game = gameTitle ?: gameMode ?: ""
        if (type == "record") {
            val label = kind?.let { recordMomentLabel(it, semantics) } ?: "record"
            val title = gameTitle?.let { "$it " } ?: ""
            val tail = if (!valueText.isNullOrEmpty()) " · $valueText" else ""
            return "$who set the all-time $title$label$tail"
        }
        val k = kind ?: ""
        return when {
            k == "gold" || k == "silver" || k == "bronze" -> "$who took $k in $game"
            k == "perfect" -> "$who played a perfect $game"
            k.startsWith("streak_") -> "$who hit a ${k.removePrefix("streak_")}-day streak"
            else -> "$who earned a medal in $game"
        }
    }
}
