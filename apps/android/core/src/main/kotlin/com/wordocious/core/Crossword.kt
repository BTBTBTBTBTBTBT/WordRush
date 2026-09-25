package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Crosswordocious — themed fill-in sayings crossword (More Games §13). 1:1 port
 * of packages/core/src/games/crossword.ts; pinned by crossword-fixtures.json
 * (CrosswordFixtureTest). A sparse criss-cross grid (10–13 entries, at most
 * 10 × 11 cells) where every clue is a familiar phrase with one blank and the
 * answer is the missing word; the title is the theme (most answers fit it, a
 * few are other sayings — nothing on the board marks which). Tap a cell or a
 * clue, type; a fully correct grid wins.
 *
 * Costs: CHECK marks wrong letters (clears them), locks right ones, and counts
 * — guess_count = min(checks, 98) + 1 against the CROSSWORD budget of 6, so no
 * Check is perfect. Reveal a letter (1 hint), reveal a word (2 hints). "Reveal
 * puzzle" is the only loss. Event sigils (§11): "=r,c:L" set, "-r,c" cleared,
 * "#n" check with n wrong, "?r,c" letter revealed, "!nD" word revealed (entry
 * number + direction), "!!" puzzle revealed. On a holiday (§20) the daily comes
 * from the bank's own holiday list.
 */
const val CROSSWORD_DAILY_EPOCH = "2026-09-23"
const val CROSSWORD_MAX_CHECKS = 98
const val CROSSWORD_TOTAL_BOARDS = 1
const val CROSSWORD_BLOCK = '.'
const val CROSSWORD_EMPTY = '_'

/** [dir]: "A" across or "D" down. [r], [c]: the first cell. */
@Serializable
data class CrosswordEntry(val n: Int, val dir: String, val r: Int, val c: Int, val answer: String, val clue: String)

@Serializable
data class CrosswordPuzzle(
    val id: String, val title: String, val theme: String, val w: Int, val h: Int, val entries: List<CrosswordEntry>,
    val holiday: String? = null,
)

@Serializable
data class CrosswordBank(
    val version: Int, val epoch: String, val daily: List<CrosswordPuzzle>, val extra: List<CrosswordPuzzle>,
    val holiday: Map<String, List<CrosswordPuzzle>>? = null,
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): CrosswordBank? = runCatching { json.decodeFromString<CrosswordBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/crossword-puzzles.json, sha-guarded to match the web copy). */
        val bundled: CrosswordBank? by lazy {
            CrosswordBank::class.java.classLoader?.getResourceAsStream("data/crossword-puzzles.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The daily puzzle for [day]: the holiday's own entry when the calendar names one, else epoch-indexed. */
fun crosswordPuzzleForDay(bank: CrosswordBank, day: String, holidays: HolidayTable? = null): CrosswordPuzzle? {
    val pick = bankHolidayPick(day, holidays, bank.holiday)
    if (pick != null) return pick.entry
    if (bank.daily.isEmpty()) return null
    return bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]
}
fun crosswordPuzzleForSeed(bank: CrosswordBank, seed: String): CrosswordPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}
fun crosswordDailyNumber(day: String): Int { val idx = Bank.dayIndex(day, CROSSWORD_DAILY_EPOCH) ?: return 1; return maxOf(1, idx + 1) }

// ── Layout ───────────────────────────────────────────────────────────────

/** Row-major index of a cell. */
fun crosswordIndex(w: Int, r: Int, c: Int): Int = r * w + c
/** The cells an entry occupies, in reading order, on a grid [w] wide. */
fun crosswordEntryCells(w: Int, e: CrosswordEntry): List<Int> {
    val out = ArrayList<Int>(e.answer.length)
    for (k in 0 until e.answer.length) out.add(crosswordIndex(w, e.r + (if (e.dir == "D") k else 0), e.c + (if (e.dir == "A") k else 0)))
    return out
}
fun crosswordEntryCells(p: CrosswordPuzzle, e: CrosswordEntry): List<Int> = crosswordEntryCells(p.w, e)
fun crosswordEntryCells(s: CrosswordState, e: CrosswordEntry): List<Int> = crosswordEntryCells(s.w, e)
/** The solution grid: w*h characters, "." for a block, the letter otherwise. */
fun crosswordSolution(p: CrosswordPuzzle): String {
    val cells = CharArray(p.w * p.h) { CROSSWORD_BLOCK }
    for (e in p.entries) crosswordEntryCells(p, e).forEachIndexed { k, i -> if (i in cells.indices) cells[i] = e.answer[k] }
    return String(cells)
}
/** Entries that pass through a cell (an across and/or a down). */
fun crosswordEntriesAt(w: Int, entries: List<CrosswordEntry>, cell: Int): List<CrosswordEntry> = entries.filter { e -> cell in crosswordEntryCells(w, e) }
fun crosswordEntriesAt(p: CrosswordPuzzle, cell: Int): List<CrosswordEntry> = crosswordEntriesAt(p.w, p.entries, cell)
fun crosswordEntriesAt(s: CrosswordState, cell: Int): List<CrosswordEntry> = crosswordEntriesAt(s.w, s.entries, cell)

// ── Reducer ──────────────────────────────────────────────────────────────

enum class CrosswordStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }

/**
 * [fill]: w*h chars — "." block, "_" empty, else the penciled letter.
 * [locked]: w*h chars — "1" locked (checked right / revealed), "0" free, "." block.
 * [revealed]: w*h chars — "l" letter revealed, "w" word revealed, "p" puzzle revealed, "." otherwise.
 * [lastWrong]: cells the last Check cleared (for the red flash).
 */
data class CrosswordState(
    val seed: String, val id: String, val title: String, val w: Int, val h: Int, val entries: List<CrosswordEntry>, val solution: String,
    val fill: String, val locked: String, val revealed: String, val checks: Int, val hintsUsed: Int, val lastWrong: List<Int>,
    val events: List<String>, val status: CrosswordStatus, val ended: Boolean, val startTime: Long, val endTime: Long?,
) {
    val guessCount: Int get() = crosswordGuessCount(checks)
    val solved: Boolean get() = crosswordIsSolved(fill, solution)
    val correctCount: Int get() = crosswordCorrectCount(fill, solution)
    val letterCount: Int get() = crosswordLetterCount(solution)
}

sealed class CrosswordAction {
    data class Set(val cell: Int, val letter: String) : CrosswordAction()
    data class Clear(val cell: Int) : CrosswordAction()
    object Check : CrosswordAction()
    data class RevealLetter(val cell: Int) : CrosswordAction()
    data class RevealWord(val n: Int, val dir: String) : CrosswordAction()
    object RevealPuzzle : CrosswordAction()
    object Finish : CrosswordAction()
}

private fun setChar(s: String, i: Int, ch: Char): String { val a = s.toCharArray(); a[i] = ch; return String(a) }
private fun blankFrom(solution: String, open: Char): String = String(CharArray(solution.length) { i -> if (solution[i] == CROSSWORD_BLOCK) CROSSWORD_BLOCK else open })

fun createCrosswordState(p: CrosswordPuzzle, seed: String, startTime: Long): CrosswordState {
    val solution = crosswordSolution(p)
    return CrosswordState(
        seed, p.id, p.title, p.w, p.h, p.entries.toList(), solution,
        blankFrom(solution, CROSSWORD_EMPTY), blankFrom(solution, '0'), blankFrom(solution, '.'), 0, 0, emptyList(), emptyList(),
        CrosswordStatus.PLAYING, false, startTime, null,
    )
}

fun crosswordIsSolved(fill: String, solution: String): Boolean = fill == solution
/** Cells right now correct (blocks never count). */
fun crosswordCorrectCount(fill: String, solution: String): Int {
    var n = 0
    for (i in solution.indices) if (solution[i] != CROSSWORD_BLOCK && i < fill.length && fill[i] == solution[i]) n++
    return n
}
fun crosswordLetterCount(solution: String): Int = solution.count { it != CROSSWORD_BLOCK }
/** guess_count for the result row: no Check = 1, capped at MAX_CHECKS + 1. */
fun crosswordGuessCount(checks: Int): Int = minOf(checks, CROSSWORD_MAX_CHECKS) + 1
/** True when every cell of the entry is filled correctly. */
fun crosswordEntrySolved(s: CrosswordState, e: CrosswordEntry): Boolean = crosswordEntryCells(s, e).all { i -> s.fill[i] == s.solution[i] }

private fun cellOk(s: CrosswordState, cell: Int): Boolean = cell >= 0 && cell < s.solution.length && s.solution[cell] != CROSSWORD_BLOCK
private fun rc(s: CrosswordState, cell: Int): String = "${cell / s.w},${cell % s.w}"

private fun settle(s: CrosswordState, now: Long): CrosswordState =
    if (s.status == CrosswordStatus.PLAYING && s.solved) s.copy(status = CrosswordStatus.WON, ended = true, endTime = now) else s
private fun revealCells(s: CrosswordState, cells: List<Int>, mark: Char): CrosswordState {
    var fill = s.fill; var locked = s.locked; var revealed = s.revealed
    for (i in cells) {
        fill = setChar(fill, i, s.solution[i])
        locked = setChar(locked, i, '1')
        if (revealed[i] == '.') revealed = setChar(revealed, i, mark)
    }
    return s.copy(fill = fill, locked = locked, revealed = revealed)
}

fun crosswordReduce(s: CrosswordState, a: CrosswordAction, now: Long = 0): CrosswordState {
    if (a is CrosswordAction.Finish) return if (s.status == CrosswordStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.ended) return s
    return when (a) {
        is CrosswordAction.Set -> {
            val letter = a.letter.uppercase()
            if (!cellOk(s, a.cell) || s.locked[a.cell] == '1' || letter.length != 1 || letter[0] !in 'A'..'Z') return s
            if (s.fill[a.cell] == letter[0]) return s
            settle(s.copy(fill = setChar(s.fill, a.cell, letter[0]), lastWrong = emptyList(), events = s.events + "=${rc(s, a.cell)}:$letter"), now)
        }
        is CrosswordAction.Clear -> {
            if (!cellOk(s, a.cell) || s.locked[a.cell] == '1' || s.fill[a.cell] == CROSSWORD_EMPTY) return s
            s.copy(fill = setChar(s.fill, a.cell, CROSSWORD_EMPTY), lastWrong = emptyList(), events = s.events + "-${rc(s, a.cell)}")
        }
        is CrosswordAction.Check -> {
            var fill = s.fill; var locked = s.locked
            val wrong = ArrayList<Int>()
            for (i in s.solution.indices) {
                if (s.solution[i] == CROSSWORD_BLOCK || s.fill[i] == CROSSWORD_EMPTY || s.locked[i] == '1') continue
                if (s.fill[i] == s.solution[i]) locked = setChar(locked, i, '1')
                else { fill = setChar(fill, i, CROSSWORD_EMPTY); wrong.add(i) }
            }
            s.copy(fill = fill, locked = locked, checks = s.checks + 1, lastWrong = wrong, events = s.events + "#${wrong.size}")
        }
        is CrosswordAction.RevealLetter -> {
            if (!cellOk(s, a.cell) || (s.locked[a.cell] == '1' && s.fill[a.cell] == s.solution[a.cell])) return s
            settle(revealCells(s, listOf(a.cell), 'l').copy(hintsUsed = s.hintsUsed + 1, lastWrong = emptyList(), events = s.events + "?${rc(s, a.cell)}"), now)
        }
        is CrosswordAction.RevealWord -> {
            val e = s.entries.firstOrNull { it.n == a.n && it.dir == a.dir } ?: return s
            if (crosswordEntrySolved(s, e)) return s
            settle(revealCells(s, crosswordEntryCells(s, e), 'w').copy(hintsUsed = s.hintsUsed + 2, lastWrong = emptyList(), events = s.events + "!${e.n}${e.dir}"), now)
        }
        is CrosswordAction.RevealPuzzle -> {
            val cells = ArrayList<Int>()
            for (i in s.solution.indices) if (s.solution[i] != CROSSWORD_BLOCK) cells.add(i)
            revealCells(s, cells, 'p').copy(lastWrong = emptyList(), events = s.events + "!!", status = CrosswordStatus.LOST, ended = true, endTime = now)
        }
        is CrosswordAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/**
 * solutions = ["id|title|wxh", solutionGrid, ...answers in entry order];
 * guesses = ["=" + fill, "h" + revealed, "c" + checks].
 */
fun crosswordMatchRow(s: CrosswordState): Pair<List<String>, List<String>> =
    (listOf("${s.id}|${s.title}|${s.w}x${s.h}", s.solution) + s.entries.map { it.answer }) to listOf("=${s.fill}", "h${s.revealed}", "c${s.checks}")

data class CrosswordReconstruction(
    val id: String, val title: String, val w: Int, val h: Int, val solution: String, val answers: List<String>,
    val fill: String, val revealed: String, val checks: Int, val correct: Int, val total: Int, val hintsUsed: Int,
    val revealedPuzzle: Boolean, val solved: Boolean,
)

private val CROSSWORD_DIMS = Regex("^(\\d+)x(\\d+)$")

fun reconstructCrossword(solutions: List<String>?, guesses: List<String>?): CrosswordReconstruction? {
    if (solutions == null || solutions.size < 3) return null
    val head = solutions[0].split("|")
    if (head.size != 3) return null
    val dims = CROSSWORD_DIMS.matchEntire(head[2]) ?: return null
    // TS: Number(...) then solution.length !== w * h — a number too big for an Int can never match, so null either way.
    val w = dims.groupValues[1].toIntOrNull() ?: return null
    val h = dims.groupValues[2].toIntOrNull() ?: return null
    val solution = solutions[1]
    if (!(w > 0 && h > 0) || solution.length.toLong() != w.toLong() * h.toLong()) return null
    var fill = ""; var revealed = ""; var checks = 0
    for (g in guesses ?: emptyList()) {
        val sigil = g.firstOrNull() ?: continue
        if (sigil == '=' && g.length == solution.length + 1) fill = g.substring(1)
        else if (sigil == 'h' && g.length == solution.length + 1) revealed = g.substring(1)
        else if (sigil == 'c') checks = maxOf(0, g.substring(1).trim().toIntOrNull() ?: 0)
    }
    if (fill.isEmpty()) fill = blankFrom(solution, CROSSWORD_EMPTY)
    if (revealed.isEmpty()) revealed = String(CharArray(solution.length) { '.' })
    var hintsUsed = 0; var wordsRevealed = false
    for (ch in revealed) { if (ch == 'l') hintsUsed += 1 else if (ch == 'w') wordsRevealed = true }
    val revealedPuzzle = 'p' in revealed
    val total = crosswordLetterCount(solution); val correct = crosswordCorrectCount(fill, solution)
    return CrosswordReconstruction(
        head[0], head[1], w, h, solution, solutions.drop(2), fill, revealed, checks, correct, total,
        hintsUsed + (if (wordsRevealed) 2 else 0), revealedPuzzle, !revealedPuzzle && correct == total,
    )
}
