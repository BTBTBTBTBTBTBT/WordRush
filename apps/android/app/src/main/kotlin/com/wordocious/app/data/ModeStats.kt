package com.wordocious.app.data

import com.wordocious.app.ui.formatGuessStat
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.min

/**
 * Per-mode stats registry — 1:1 port of apps/web/lib/mode-stats.ts (More Games
 * §18, Stage 3b + the per-game profiles).
 *
 * One pure, fixture-pinned mechanism instead of a hand-built panel per game:
 * every mode declares which stat lines its detail page shows (the 4×2 grid)
 * and which cards below the grid apply. The DEFAULT profile reproduces the
 * word modes' eight cells byte-for-byte; each custom game has ONE profile row
 * whose cells are derived from the user_stats totals AND from a pure aggregate
 * over that mode's matches rows ([modeAggregates]).
 *
 * Pinned by mode-stats-fixtures.json (ModeStatsFixtureTest) alongside the web
 * and Swift copies. Keep this file dependency-free apart from ui/Format.kt.
 */
object ModeStats {
    data class Totals(
        val wins: Int,
        val losses: Int,
        val totalGames: Int,
        /** Best (lowest) guess_count; 0 = none yet. */
        val bestScore: Int,
        /** Fastest win in seconds; 0 = none yet. */
        val fastestTime: Int,
        /** Current and best win streak for this mode + play type. */
        val streak: Int,
        val bestStreak: Int,
    )

    data class Line(val label: String, val value: String)

    /** Which cards below the grid apply to a mode. */
    data class Panels(
        val guessDistribution: Boolean,
        val solveTime: Boolean,
        val topWords: Boolean,
        val openerYield: Boolean,
        val positionAccuracy: Boolean,
        val stageBreakdown: Boolean,
    )

    /**
     * One matches row as the aggregate reads it — property names ARE the
     * fixture / daily_results JSON keys. The app maps matches columns onto
     * them (player1_score → guess_count, winner_id → completed,
     * player1_time → time_seconds). A null boards_solved / total_boards means
     * "not stored on this row": the aggregate rebuilds them from the event log.
     */
    @Suppress("PropertyName")
    @Serializable
    data class MatchRow(
        val guess_count: Int = 0,
        val completed: Boolean = false,
        val time_seconds: Int = 0,
        val hints_used: Int = 0,
        val boards_solved: Int? = null,
        val total_boards: Int? = null,
        val player1_guesses: List<String> = emptyList(),
        val solutions: List<String> = emptyList(),
        val seed: String? = null,
    )

    /** Pure sums over a mode's matches rows — every field an integer or a string. */
    @Serializable
    data class ModeAggregates(
        val games: Int = 0,
        val wins: Int = 0,
        /** Wins at the perfect guess_count with no hints — "Clean" / "Perfect". */
        val cleanWins: Int = 0,
        /** Wins at the perfect guess_count, hints or not — Par Rate, Spyglass "Clean". */
        val perfectWins: Int = 0,
        val noHintWins: Int = 0,
        /** Sum of guess_count over wins; a line divides by wins and subtracts guessBase. */
        val winGuessTotal: Int = 0,
        /** Sum of time_seconds over wins with a positive time, and how many such wins. */
        val winTimeTotal: Int = 0,
        val timedWins: Int = 0,
        /** Fastest win at the perfect guess_count (seconds; 0 = none). */
        val fastestPerfect: Int = 0,
        /** Sums of boards_solved and total_boards over every game (stored or rebuilt). */
        val boardsSolved: Int = 0,
        val boardsTotal: Int = 0,
        /** Kindred: games whose first solved group was the tier-4 (hardest) one. */
        val hardestFirst: Int = 0,
        /** Hubbub: scored words using all seven letters, across every game. */
        val pangrams: Int = 0,
        /** Hubbub: the longest word the player entered ("" = none). */
        val longestWord: String = "",
    )

    val EMPTY_AGGREGATES = ModeAggregates()

    /** "-" for none, "45s", "2m", "2m 5s" — the grid's own compact time (never "0s"). */
    fun statTime(seconds: Int): String {
        if (seconds <= 0) return "-"
        if (seconds < 60) return "${seconds}s"
        val m = seconds / 60; val s = seconds % 60
        return if (s > 0) "${m}m ${s}s" else "${m}m"
    }

    fun winRatePct(wins: Int, totalGames: Int): Int =
        if (totalGames > 0) Math.round(wins.toDouble() / totalGames * 100).toInt() else 0

    private fun pct(n: Int, d: Int): String = "${if (d > 0) Math.round(n.toDouble() / d * 100) else 0}%"

    /**
     * One-decimal average with integer maths: (total − sub·n) / n rounded to
     * tenths, "-" when n is 0. 13 mistakes over 5 wins → "2.6"; 5 over 5 → "1.0".
     */
    fun avg1(total: Int, n: Int, sub: Int = 0): String {
        if (n <= 0) return "-"
        val tenths = max(0L, Math.round((total - sub.toLong() * n) * 10.0 / n))
        return "${tenths / 10}.${tenths % 10}"
    }

    // ── The perfect guess_count and board count per custom mode ───────────────
    // guessBase is passed in from the catalog; the board counts are the engines'
    // constants (SCRAMBLE_TOTAL_BOARDS, HUB_TOTAL_BOARDS, GROUPS_TOTAL_BOARDS,
    // Spyglass's ten words), repeated here so this file stays dependency-free.
    private val TOTAL_BOARDS = mapOf("SCRAMBLE" to 5, "HUB" to 20, "GROUPS" to 4, "WORDSEARCH" to 10)
    private const val WORDSEARCH_WORDS = 10

    /** Hubbub word score (hub.ts hubWordScore): 4 letters = 1, longer = length, pangram +7. */
    private fun hubScore(word: String, letters: String): Int =
        (if (word.length == 4) 1 else word.length) + (if (isPangram(word, letters)) 7 else 0)

    private fun isPangram(word: String, letters: String): Boolean {
        if (letters.isEmpty()) return false
        for (ch in letters) if (!word.contains(ch)) return false
        return true
    }

    private val SCRAMBLE_SOLVED = Regex("^[0-4](✓|H)")
    private val HUB_WORD = Regex("^[A-Z]{4,}$")

    /**
     * boards_solved for a row that did not store it, rebuilt from the event log
     * exactly as the game's finalizer computed it. Anything unrecognised: the win
     * flag over one board.
     */
    fun boardsFromEvents(dbKey: String, row: MatchRow): Int {
        val ev = row.player1_guesses
        return when (dbKey) {
            // "i✓WORD" solved by the player, "iH" solved by hint — i is 0–3 words, 4 punchline
            "SCRAMBLE" -> min(TOTAL_BOARDS.getValue("SCRAMBLE"), ev.count { SCRAMBLE_SOLVED.containsMatchIn(it) })
            // "+t:W1,W2,W3,W4" solved tier t
            "GROUPS" -> min(TOTAL_BOARDS.getValue("GROUPS"), ev.count { it.startsWith("+") })
            // "+WORD" found (hinted words arrive as "?WORD" then "+WORD")
            "WORDSEARCH" -> min(TOTAL_BOARDS.getValue("WORDSEARCH"), ev.count { it.startsWith("+") })
            // floor(points × 20 / max); "+WORD" scored, "!WORD" revealed (also scored)
            "HUB" -> {
                val letters = row.solutions.getOrNull(1) ?: ""
                val max = row.solutions.getOrNull(2)?.trim()?.toDoubleOrNull() ?: 0.0
                if (max <= 0) return 0
                var points = 0
                for (e in ev) if (e.startsWith("+") || e.startsWith("!")) points += hubScore(e.substring(1), letters)
                val total = TOTAL_BOARDS.getValue("HUB")
                min(total, Math.floor(points * total / max).toInt())
            }
            else -> if (row.completed) 1 else 0
        }
    }

    /**
     * The pure aggregate over a mode's matches rows. Order-independent (the one
     * string field breaks ties alphabetically) so the newest-first web slice and a
     * native cache in any order agree. Unknown modes still get the generic sums.
     */
    fun modeAggregates(dbKey: String, matches: List<MatchRow>, guessBase: Int = 1): ModeAggregates {
        var games = 0; var wins = 0; var cleanWins = 0; var perfectWins = 0; var noHintWins = 0
        var winGuessTotal = 0; var winTimeTotal = 0; var timedWins = 0; var fastestPerfect = 0
        var boardsSolved = 0; var boardsTotal = 0; var hardestFirst = 0; var pangrams = 0
        var longestWord = ""
        for (row in matches) {
            val won = row.completed
            val g = max(0, row.guess_count)
            val t = max(0, row.time_seconds)
            val hints = max(0, row.hints_used)
            val ev = row.player1_guesses
            games++
            if (won) {
                wins++
                winGuessTotal += g
                if (hints == 0) noHintWins++
                if (g == guessBase) {
                    perfectWins++
                    if (hints == 0) cleanWins++
                    if (t > 0 && (fastestPerfect == 0 || t < fastestPerfect)) fastestPerfect = t
                }
                if (t > 0) { winTimeTotal += t; timedWins++ }
            }
            val storedTotal = row.total_boards
            val total = if (storedTotal != null && storedTotal > 0) storedTotal else (TOTAL_BOARDS[dbKey] ?: 1)
            val stored = row.boards_solved
            val solved = if (stored != null) max(0, min(total, stored)) else boardsFromEvents(dbKey, row)
            boardsSolved += solved
            boardsTotal += total

            if (dbKey == "GROUPS") {
                val first = ev.firstOrNull { it.startsWith("+") }
                if (first != null && first.startsWith("+4:")) hardestFirst++
            }
            if (dbKey == "HUB") {
                val letters = row.solutions.getOrNull(1) ?: ""
                for (e in ev) {
                    if (e.isEmpty()) continue
                    val sigil = e[0]; val word = e.substring(1)
                    if ((sigil != '+' && sigil != '=') || !HUB_WORD.matches(word)) continue
                    if (sigil == '+' && isPangram(word, letters)) pangrams++
                    if (word.length > longestWord.length || (word.length == longestWord.length && word < longestWord)) longestWord = word
                }
            }
        }
        return ModeAggregates(
            games = games, wins = wins, cleanWins = cleanWins, perfectWins = perfectWins, noHintWins = noHintWins,
            winGuessTotal = winGuessTotal, winTimeTotal = winTimeTotal, timedWins = timedWins, fastestPerfect = fastestPerfect,
            boardsSolved = boardsSolved, boardsTotal = boardsTotal, hardestFirst = hardestFirst, pangrams = pangrams,
            longestWord = longestWord,
        )
    }

    // ── Profiles ───────────────────────────────────────────────────────────────

    private fun interface Lines {
        fun of(t: Totals, semantics: String, guessBase: Int, a: ModeAggregates): List<Line>
    }

    private fun avgTime(a: ModeAggregates): String =
        statTime(if (a.timedWins > 0) Math.round(a.winTimeTotal.toDouble() / a.timedWins).toInt() else 0)

    /** The eight cells every word mode shows: Wins · Losses · Games · Win Rate · Best · Fastest · Streak · Best Streak. */
    private val defaultLines = Lines { t, semantics, guessBase, _ ->
        // "Best" is the best guess_count, read through the mode's semantics: "4 guesses"
        // stays a bare number for the word modes (today's display), but a Sudoku best
        // of guess_count 1 must read "0 mistakes", never "1".
        val best = if (t.bestScore > 0) {
            if (semantics == "guesses") t.bestScore.toString() else formatGuessStat(semantics, guessBase, t.bestScore)
        } else "-"
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Games", t.totalGames.toString()),
            Line("Win Rate", "${winRatePct(t.wins, t.totalGames)}%"),
            Line("Best", best),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Streak", t.streak.toString()),
            Line("Best Streak", t.bestStreak.toString()),
        )
    }

    /** Sudoku, Starsweep: Wins · Losses · Win Rate · Clean · Avg Mistakes · Fastest · No-hint Wins · Streak. */
    private val mistakesLines = Lines { t, _, base, a ->
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Win Rate", pct(t.wins, t.totalGames)),
            Line("Clean", a.cleanWins.toString()),
            Line("Avg Mistakes", avg1(a.winGuessTotal, a.wins, base)),
            Line("Fastest", statTime(t.fastestTime)),
            Line("No-hint Wins", a.noHintWins.toString()),
            Line("Streak", t.streak.toString()),
        )
    }

    /** Letter Ladder: Wins · Losses · Par Rate · Avg Over Par · Fastest Par · No-hint Wins · Streak · Best Streak. */
    private val ladderLines = Lines { t, _, base, a ->
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Par Rate", pct(a.perfectWins, a.wins)),
            Line("Avg Over Par", avg1(a.winGuessTotal, a.wins, base)),
            Line("Fastest Par", statTime(a.fastestPerfect)),
            Line("No-hint Wins", a.noHintWins.toString()),
            Line("Streak", t.streak.toString()),
            Line("Best Streak", t.bestStreak.toString()),
        )
    }

    /** Muddle: Wins · Losses · Win Rate · Clean · Avg Checks · Fastest · Words Solved · Streak. */
    private val scrambleLines = Lines { t, _, _, a ->
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Win Rate", pct(t.wins, t.totalGames)),
            Line("Clean", a.cleanWins.toString()),
            Line("Avg Checks", avg1(a.winGuessTotal, a.wins)),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Words Solved", a.boardsSolved.toString()),
            Line("Streak", t.streak.toString()),
        )
    }

    /** Spyglass: Cleared · Losses · Win Rate · Clean · Fastest · Avg Time · Sec / Word · Streak. */
    private val wordsearchLines = Lines { t, _, _, a ->
        val tenths = if (a.timedWins > 0) Math.round(a.winTimeTotal * 10.0 / (a.timedWins * WORDSEARCH_WORDS)) else 0L
        listOf(
            Line("Cleared", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Win Rate", pct(t.wins, t.totalGames)),
            Line("Clean", a.perfectWins.toString()),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Avg Time", avgTime(a)),
            Line("Sec / Word", if (tenths > 0) "${tenths / 10}.${tenths % 10}s" else "-"),
            Line("Streak", t.streak.toString()),
        )
    }

    /** Hubbub: Days Played · Hubbub+ · Pandemonium · Best Rank · Avg % Max · Pangrams · Longest Word · Streak. */
    private val hubLines = Lines { t, _, base, a ->
        listOf(
            Line("Days Played", t.totalGames.toString()),
            Line("Hubbub+", t.wins.toString()),
            Line("Pandemonium", a.perfectWins.toString()),
            Line("Best Rank", if (t.bestScore > 0) formatGuessStat("rank", base, t.bestScore) else "-"),
            Line("Avg % Max", pct(a.boardsSolved, a.boardsTotal)),
            Line("Pangrams", a.pangrams.toString()),
            Line("Longest Word", a.longestWord.ifEmpty { "-" }),
            Line("Streak", t.streak.toString()),
        )
    }

    /** Crosswordocious, Codebreaker: Wins · Losses · Win Rate · Clean · No-hint Wins · Fastest · Avg Time · Streak. */
    private val checksLines = Lines { t, _, _, a ->
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Win Rate", pct(t.wins, t.totalGames)),
            Line("Clean", a.cleanWins.toString()),
            Line("No-hint Wins", a.noHintWins.toString()),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Avg Time", avgTime(a)),
            Line("Streak", t.streak.toString()),
        )
    }

    /** Kindred: Wins · Losses · Win Rate · Perfect · Avg Mistakes · Hardest 1st · Fastest · Streak. */
    private val groupsLines = Lines { t, _, base, a ->
        listOf(
            Line("Wins", t.wins.toString()),
            Line("Losses", t.losses.toString()),
            Line("Win Rate", pct(t.wins, t.totalGames)),
            Line("Perfect", a.cleanWins.toString()),
            Line("Avg Mistakes", avg1(a.winGuessTotal, a.wins, base)),
            Line("Hardest 1st", a.hardestFirst.toString()),
            Line("Fastest", statTime(t.fastestTime)),
            Line("Streak", t.streak.toString()),
        )
    }

    private val WORD_PANELS = Panels(guessDistribution = true, solveTime = true, topWords = true, openerYield = true, positionAccuracy = true, stageBreakdown = false)
    /** Custom engines: solve-time trend only — no word rows, so no word-only cards. */
    private val CUSTOM_PANELS = Panels(guessDistribution = false, solveTime = true, topWords = false, openerYield = false, positionAccuracy = false, stageBreakdown = false)
    /** Kindred (4–7 submissions) and Muddle (5–13 checks) have a histogram worth drawing. */
    private val CUSTOM_DIST_PANELS = CUSTOM_PANELS.copy(guessDistribution = true)

    private class Profile(val lines: Lines, val panels: Panels)

    /**
     * Registry keyed by dbKey. Missing = the default word profile (word-only
     * cards on for "guesses" semantics, off for any other).
     */
    private val PROFILES: Map<String, Profile> = mapOf(
        "GAUNTLET" to Profile(defaultLines, WORD_PANELS.copy(guessDistribution = false, stageBreakdown = true)),
        // ProperNoundle guesses names, not words: the word grid + distribution apply,
        // but "Top words" / opener yield / position accuracy would be noise.
        "PROPERNOUNDLE" to Profile(defaultLines, CUSTOM_PANELS.copy(guessDistribution = true)),
        "SUDOKU" to Profile(mistakesLines, CUSTOM_PANELS),
        "REGIONS" to Profile(mistakesLines, CUSTOM_PANELS),
        "LADDER" to Profile(ladderLines, CUSTOM_PANELS),
        "SCRAMBLE" to Profile(scrambleLines, CUSTOM_DIST_PANELS),
        "WORDSEARCH" to Profile(wordsearchLines, CUSTOM_PANELS),
        "HUB" to Profile(hubLines, CUSTOM_PANELS),
        "CROSSWORD" to Profile(checksLines, CUSTOM_PANELS),
        "CRYPTOGRAM" to Profile(checksLines, CUSTOM_PANELS),
        "GROUPS" to Profile(groupsLines, CUSTOM_DIST_PANELS),
    )

    /**
     * The 4×2 grid for a mode. `aggregates` is `modeAggregates(dbKey, matches)`;
     * omitted (or no rows yet) every matches-derived cell reads "-", "0" or "0%".
     */
    fun statLines(dbKey: String, totals: Totals, semantics: String = "guesses", guessBase: Int = 1, aggregates: ModeAggregates? = null): List<Line> =
        (PROFILES[dbKey]?.lines ?: defaultLines).of(totals, semantics, guessBase, aggregates ?: EMPTY_AGGREGATES)

    fun statPanels(dbKey: String, semantics: String = "guesses"): Panels {
        PROFILES[dbKey]?.let { return it.panels }
        // A mode whose guess_count is not "guesses" is a custom engine: no word-only cards.
        return if (semantics == "guesses") WORD_PANELS else CUSTOM_PANELS
    }

    // ── Guess-distribution card ────────────────────────────────────────────────

    /** Inclusive histogram bucket range. */
    data class BucketRange(val min: Int, val max: Int)

    /**
     * The histogram's bucket range for the custom games that draw one — Kindred
     * 4–7 submissions, Muddle 5–13 checks. Null = the word modes' own table.
     */
    fun guessDistributionRange(dbKey: String): BucketRange? = when (dbKey) {
        "GROUPS" -> BucketRange(4, 7)
        "SCRAMBLE" -> BucketRange(5, 13)
        else -> null
    }

    /** The unit the histogram counts, singular and plural. */
    data class Noun(val one: String, val many: String)

    /** guess / check / mistake / miss, from the catalog semantics. */
    fun guessNoun(semantics: String): Noun = when (semantics) {
        "checks" -> Noun("check", "checks")
        "mistakes" -> Noun("mistake", "mistakes")
        "misses" -> Noun("miss", "misses")
        else -> Noun("guess", "guesses")
    }

    // ── Leaderboard / records labels through the semantics ─────────────────────

    /**
     * A leaderboard row's guess stat, title-cased the way the rows read today
     * ("4 Guesses · 1:23"): "0 Mistakes", "5 Checks", "2 Misses", "Par",
     * "+2 over par", "Hubbub".
     */
    fun guessRowLabel(semantics: String, guessBase: Int, guessCount: Int): String {
        val s = formatGuessStat(semantics, guessBase, guessCount)
        if (semantics == "rank") return s
        if (semantics == "overPar") return if (s == "Par") s else "$s over par"
        val sp = s.indexOf(' ')
        if (sp < 0 || sp + 1 >= s.length) return s
        return s.substring(0, sp + 1) + s[sp + 1].uppercaseChar() + s.substring(sp + 2)
    }

    /** The "fewest_guesses" record's title for a mode: what a low guess_count means there. */
    fun fewestRecordLabel(semantics: String): String = when (semantics) {
        "mistakes" -> "Fewest Mistakes"
        "checks" -> "Fewest Checks"
        "overPar" -> "Best vs Par"
        "misses" -> "Fewest Misses"
        "rank" -> "Best Rank"
        else -> "Fewest Guesses"
    }
}
