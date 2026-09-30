package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.abs
import kotlin.math.sign

/**
 * Spyglass — themed word search (More Games §17). 1:1 port of
 * packages/core/src/games/wordsearch.ts; pinned by wordsearch-fixtures.json
 * (WordsearchFixtureTest). A selection is a straight line in any of the eight
 * directions; it finds a word when its letters spell a list word forwards or
 * backwards; a miss is a straight line of ≥ 4 cells spelling no list word.
 * Hidden list (2026-09-26): the words start hidden; Show words lists the rest and every
 * later find counts like a miss. guess_count = min(10 + misses + lateFinds, 15).
 * Event sigils: + ~ x ? = !
 * Close calls (founder, 2026-09-30): a selection spelling one of the puzzle's `near` words (a theme
 * word or plural that really sits in the grid but is not on the list) is never a miss; the screen
 * says it fits the theme but isn't one of today's 10.
 */
const val WORDSEARCH_DAILY_EPOCH = "2026-09-23"
const val WORDSEARCH_N = 10
const val WORDSEARCH_WORDS = 10
const val WORDSEARCH_MAX_MISSES = 5
const val WORDSEARCH_MIN_MISS_LENGTH = 4

val WORDSEARCH_DIRS: Map<String, Pair<Int, Int>> = mapOf(
    "E" to (0 to 1), "S" to (1 to 0), "SE" to (1 to 1), "NE" to (-1 to 1),
    "W" to (0 to -1), "N" to (-1 to 0), "NW" to (-1 to -1), "SW" to (1 to -1),
)

@Serializable
data class WordsearchPlacement(val w: String, val r: Int, val c: Int, val d: String)

@Serializable
data class WordsearchPuzzle(
    val id: String, val theme: String, val family: String, val title: String, val grid: String, val words: List<WordsearchPlacement>,
    /** Close calls: theme words / plurals in the grid that are not list words (never a miss). Optional in the bank. */
    val near: List<String> = emptyList(),
)

@Serializable
data class WordsearchBank(val version: Int, val epoch: String, val daily: List<WordsearchPuzzle>, val extra: List<WordsearchPuzzle>) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): WordsearchBank? = runCatching { json.decodeFromString<WordsearchBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/wordsearch-puzzles.json, sha-guarded to match the web copy). */
        val bundled: WordsearchBank? by lazy {
            WordsearchBank::class.java.classLoader?.getResourceAsStream("data/wordsearch-puzzles.json")
                ?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

fun wordsearchPuzzleForDay(bank: WordsearchBank, day: String): WordsearchPuzzle? =
    if (bank.daily.isEmpty()) null else bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]

fun wordsearchPuzzleForSeed(bank: WordsearchBank, seed: String): WordsearchPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}

fun wordsearchDailyNumber(day: String): Int {
    val idx = Bank.dayIndex(day, WORDSEARCH_DAILY_EPOCH) ?: return 1
    return maxOf(1, idx + 1)
}

// ── Geometry ─────────────────────────────────────────────────────────────

fun wordsearchCells(n: Int, p: WordsearchPlacement): List<Int> {
    val (dr, dc) = WORDSEARCH_DIRS[p.d] ?: (0 to 1)
    return (0 until p.w.length).map { k -> (p.r + dr * k) * n + (p.c + dc * k) }
}

fun wordsearchLine(n: Int, from: Int, to: Int): List<Int>? {
    if (from < 0 || to < 0 || from >= n * n || to >= n * n) return null
    val r0 = from / n; val c0 = from % n; val r1 = to / n; val c1 = to % n
    val dr = (r1 - r0).sign; val dc = (c1 - c0).sign
    val len = maxOf(abs(r1 - r0), abs(c1 - c0)) + 1
    if (dr != 0 && dc != 0 && abs(r1 - r0) != abs(c1 - c0)) return null
    return (0 until len).map { k -> (r0 + dr * k) * n + (c0 + dc * k) }
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class WordsearchStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }

data class WordsearchState(
    val seed: String, val id: String, val title: String, val n: Int, val grid: String, val words: List<WordsearchPlacement>,
    val found: List<String>, val misses: Int, val hintsUsed: Int, val hinted: List<String>, val events: List<String>,
    val status: WordsearchStatus, val startTime: Long, val endTime: Long?,
    /** Show words used: the remaining words are listed; later finds count like misses. */
    val wordsShown: Boolean = false,
    /** Words found after Show words (each adds one to guess_count). */
    val lateFinds: Int = 0,
    /** Close calls from the puzzle (saves from before 2026-09-30 lack them). */
    val near: List<String> = emptyList(),
) {
    /** guess_count for the result row: 10 clean, +1 per miss and per late find, capped at 15. */
    val guessCount: Int get() = minOf(WORDSEARCH_WORDS + WORDSEARCH_MAX_MISSES, WORDSEARCH_WORDS + maxOf(0, misses) + maxOf(0, lateFinds))
    /** The Hint target: the first unfound, un-pulsed word (else the first unfound). */
    val nextUnfound: WordsearchPlacement? get() = words.firstOrNull { it.w !in found && it.w !in hinted } ?: words.firstOrNull { it.w !in found }

    companion object {
        fun create(p: WordsearchPuzzle, seed: String, startTime: Long) = WordsearchState(
            seed, p.id, p.title, WORDSEARCH_N, p.grid, p.words, emptyList(), 0, 0, emptyList(), emptyList(), WordsearchStatus.PLAYING, startTime, null,
            near = p.near,
        )
    }
}

sealed class WordsearchAction {
    data class Select(val from: Int, val to: Int) : WordsearchAction()
    object Hint : WordsearchAction()
    object Show : WordsearchAction()
    object Reveal : WordsearchAction()
    object Finish : WordsearchAction()
}

/** The close-call word a selection spells (forwards or backwards), if it is not a list word; else null. */
fun wordsearchNearWord(s: WordsearchState, from: Int, to: Int): String? {
    if (s.near.isEmpty()) return null
    val line = wordsearchLine(s.n, from, to) ?: return null
    val letters = line.map { s.grid[it] }.joinToString("")
    val reversed = letters.reversed()
    if (s.words.any { it.w == letters || it.w == reversed }) return null
    return s.near.firstOrNull { it == letters || it == reversed }
}

fun wordsearchReduce(s: WordsearchState, a: WordsearchAction, now: Long = 0): WordsearchState {
    if (a is WordsearchAction.Finish) return if (s.status == WordsearchStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.status != WordsearchStatus.PLAYING) return s
    return when (a) {
        is WordsearchAction.Select -> {
            val line = wordsearchLine(s.n, a.from, a.to) ?: return s
            val letters = line.map { s.grid[it] }.joinToString("")
            val reversed = letters.reversed()
            val hit = s.words.firstOrNull { it.w == letters || it.w == reversed }
            if (hit != null) {
                if (hit.w in s.found) return s
                val found = s.found + hit.w
                val won = found.size == s.words.size
                val late = s.wordsShown
                s.copy(found = found, lateFinds = s.lateFinds + (if (late) 1 else 0), events = s.events + "${if (late) "~" else "+"}${hit.w}", status = if (won) WordsearchStatus.WON else WordsearchStatus.PLAYING, endTime = if (won) now else null)
            } else if (line.size < WORDSEARCH_MIN_MISS_LENGTH) s
            else if (s.near.any { it == letters || it == reversed }) s // close call: never a miss
            else s.copy(misses = s.misses + 1, events = s.events + "x ${a.from / s.n},${a.from % s.n}>${a.to / s.n},${a.to % s.n}")
        }
        is WordsearchAction.Hint -> {
            val target = s.words.firstOrNull { it.w !in s.found && it.w !in s.hinted } ?: return s
            s.copy(hinted = s.hinted + target.w, hintsUsed = s.hintsUsed + 1, events = s.events + "?${target.w}")
        }
        is WordsearchAction.Show -> if (s.wordsShown) s else s.copy(wordsShown = true, events = s.events + "=")
        is WordsearchAction.Reveal -> s.copy(status = WordsearchStatus.LOST, endTime = now, events = s.events + "!")
        is WordsearchAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

fun wordsearchMatchRow(s: WordsearchState): Pair<List<String>, List<String>> =
    (listOf("g:${s.grid}", "t:${s.title}") + s.words.map { "${it.w}@${it.r},${it.c},${it.d}" }) to s.events

data class WordsearchReconstruction(
    val grid: String, val title: String, val words: List<WordsearchPlacement>,
    val found: List<String>, val misses: Int, val hintsUsed: Int, val revealed: Boolean, val solved: Boolean,
    val wordsShown: Boolean = false, val lateFinds: Int = 0,
)

private val PLACEMENT_RE = Regex("^([A-Z]{2,})@(\\d+),(\\d+),(NE|NW|SE|SW|N|S|E|W)$")

fun reconstructWordsearch(solutions: List<String>, guesses: List<String>): WordsearchReconstruction? {
    if (solutions.size < 3 || !solutions[0].startsWith("g:") || !solutions[1].startsWith("t:")) return null
    val grid = solutions[0].substring(2)
    if (grid.length != WORDSEARCH_N * WORDSEARCH_N || !grid.all { it in 'A'..'Z' }) return null
    val words = solutions.drop(2).mapNotNull { f ->
        PLACEMENT_RE.matchEntire(f)?.let { m -> WordsearchPlacement(m.groupValues[1], m.groupValues[2].toInt(), m.groupValues[3].toInt(), m.groupValues[4]) }
    }
    if (words.isEmpty()) return null
    val found = ArrayList<String>(); var misses = 0; var hintsUsed = 0; var revealed = false; var wordsShown = false; var lateFinds = 0
    for (ev in guesses) {
        if (ev == "!") { revealed = true; continue }
        if (ev == "=") { wordsShown = true; continue }
        val sigil = ev.firstOrNull() ?: continue
        val rest = ev.substring(1)
        when (sigil) {
            '+', '~' -> if (words.any { it.w == rest } && rest !in found) { found.add(rest); if (sigil == '~') lateFinds++ }
            'x' -> misses++
            '?' -> hintsUsed++
        }
    }
    return WordsearchReconstruction(grid, solutions[1].substring(2), words, found, misses, hintsUsed, revealed, found.size == words.size, wordsShown, lateFinds)
}
