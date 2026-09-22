package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Letter Ladder — word ladder (More Games §15). 1:1 port of
 * packages/core/src/games/ladder.ts; pinned by ladder-fixtures.json
 * (LadderFixtureTest). Change one letter at a time from START to END; every
 * rung must be a legal 5-letter guess. Rejected entries are free; every
 * accepted word is a move; the budget is par + 5; Undo is free but spent moves
 * stay spent; a Hint places the next rung on a shortest path (BFS over the
 * allowed list, alphabetical tie-break) and counts as a move.
 * guess_count = moves − par + 1. Event strings carry §11 sigils (+ - ?).
 */
const val LADDER_DAILY_EPOCH = "2026-09-23"
const val LADDER_EXTRA_MOVES = 5
const val LADDER_WORD_LENGTH = 5

@Serializable
data class LadderPuzzle(val id: String, val start: String, val end: String, val par: Int, val path: List<String>)

@Serializable
data class LadderBank(val version: Int, val epoch: String, val daily: List<LadderPuzzle>, val extra: List<LadderPuzzle>) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): LadderBank? = runCatching { json.decodeFromString<LadderBank>(text) }.getOrNull()

        /** The bundled bank (core resources/data/ladder-puzzles.json, sha-guarded to match the web copy). */
        val bundled: LadderBank? by lazy {
            LadderBank::class.java.classLoader?.getResourceAsStream("data/ladder-puzzles.json")
                ?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The daily puzzle for [day] (yyyy-MM-dd), epoch-indexed; null for an empty bank. */
fun ladderPuzzleForDay(bank: LadderBank, day: String): LadderPuzzle? =
    if (bank.daily.isEmpty()) null else bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]

/** The Unlimited puzzle for a seed, drawn from `extra` so it can never spoil a daily. */
fun ladderPuzzleForSeed(bank: LadderBank, seed: String): LadderPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}

/** "#N" for the daily on [day]; 1 on the epoch day, never below 1. */
fun ladderDailyNumber(day: String): Int {
    val idx = Bank.dayIndex(day, LADDER_DAILY_EPOCH) ?: return 1
    return maxOf(1, idx + 1)
}

// ── Word graph helpers ───────────────────────────────────────────────────

private const val LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** True when a and b are the same length and differ in exactly one position. */
fun ladderOneLetterApart(a: String, b: String): Boolean {
    if (a.length != b.length) return false
    var diff = 0
    for (i in a.indices) if (a[i] != b[i]) { diff++; if (diff > 1) return false }
    return diff == 1
}

/** Every word in [allowed] one letter away from [w], alphabetical. */
fun ladderNeighbours(w: String, allowed: Set<String>): List<String> {
    val out = ArrayList<String>()
    val chars = w.toCharArray()
    for (i in chars.indices) {
        val orig = chars[i]
        for (ch in LETTERS) {
            if (ch == orig) continue
            chars[i] = ch
            val cand = String(chars)
            if (cand in allowed) out.add(cand)
        }
        chars[i] = orig
    }
    out.sort()
    return out
}

/**
 * The next rung on a shortest path from [current] to [end] over [allowed],
 * never stepping onto a word in [avoid]. BFS from [end]; among current's
 * neighbours one step closer, the alphabetically first. Null when no route.
 */
fun ladderNextStep(current: String, end: String, allowed: Set<String>, avoid: Set<String> = emptySet()): String? {
    if (current == end) return null
    if (ladderOneLetterApart(current, end)) return end
    val usable = HashSet<String>()
    for (w in allowed) if (w !in avoid || w == end) usable.add(w)
    usable.add(end)
    val dist = HashMap<String, Int>().apply { put(end, 0) }
    var frontier = listOf(end)
    while (frontier.isNotEmpty() && current !in dist) {
        val next = ArrayList<String>()
        for (u in frontier) {
            val du = dist[u]!!
            for (v in ladderNeighbours(u, usable)) if (v !in dist) { dist[v] = du + 1; next.add(v) }
            if (ladderOneLetterApart(u, current) && current !in dist) dist[current] = du + 1
        }
        frontier = next
    }
    val dc = dist[current] ?: return null
    return ladderNeighbours(current, usable).firstOrNull { dist[it] == dc - 1 }
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class LadderStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }
enum class LadderReject(val key: String) { FINISHED("finished"), LENGTH("length"), NOT_ONE_LETTER("not-one-letter"), REVISIT("revisit"), NOT_WORD("not-word") }

data class LadderState(
    val seed: String, val id: String, val start: String, val end: String, val par: Int, val path: List<String>,
    val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val events: List<String>,
    val status: LadderStatus, val reject: LadderReject?, val startTime: Long, val endTime: Long?,
) {
    val current: String get() = words.last()
    val maxMoves: Int get() = par + LADDER_EXTRA_MOVES
    /** guess_count for the result row: par reads as 1, one over par as 2. Never below 1. */
    val guessCount: Int get() = maxOf(1, moves - par + 1)

    companion object {
        fun create(p: LadderPuzzle, seed: String, startTime: Long) = LadderState(
            seed, p.id, p.start, p.end, p.par, p.path, listOf(p.start), "0", 0, 0, emptyList(),
            LadderStatus.PLAYING, null, startTime, null,
        )
    }
}

sealed class LadderAction {
    data class Submit(val word: String) : LadderAction()
    object Undo : LadderAction()
    object Hint : LadderAction()
    object Finish : LadderAction()
}

private val FIVE_UPPER = Regex("^[A-Z]{5}$")

private fun settle(s: LadderState, now: Long): LadderState {
    if (s.status != LadderStatus.PLAYING) return s
    if (s.current == s.end) return s.copy(status = LadderStatus.WON, endTime = now)
    if (s.moves >= s.maxMoves) return s.copy(status = LadderStatus.LOST, endTime = now)
    return s
}

private fun accept(s: LadderState, word: String, viaHint: Boolean, now: Long): LadderState = settle(
    s.copy(
        words = s.words + word, hintMask = s.hintMask + (if (viaHint) "1" else "0"), moves = s.moves + 1,
        hintsUsed = s.hintsUsed + if (viaHint) 1 else 0, events = s.events + ((if (viaHint) "?" else "+") + word), reject = null,
    ),
    now,
)

private fun nextOnCanonicalPath(s: LadderState): String? {
    val i = s.path.indexOf(s.current)
    if (i < 0 || i + 1 >= s.path.size) return null
    val next = s.path[i + 1]
    return if (next in s.words) null else next
}

/** Pure reducer; [allowed] is the uppercase 5-letter guess list; [now] stamps endTime. */
fun ladderReduce(s: LadderState, a: LadderAction, allowed: Set<String>, now: Long = 0): LadderState {
    if (a is LadderAction.Finish) return if (s.status == LadderStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.status != LadderStatus.PLAYING) return if (a is LadderAction.Submit) s.copy(reject = LadderReject.FINISHED) else s
    return when (a) {
        is LadderAction.Submit -> {
            val word = a.word.uppercase()
            when {
                word.length != LADDER_WORD_LENGTH || !FIVE_UPPER.matches(word) -> s.copy(reject = LadderReject.LENGTH)
                !ladderOneLetterApart(s.current, word) -> s.copy(reject = LadderReject.NOT_ONE_LETTER)
                word in s.words -> s.copy(reject = LadderReject.REVISIT)
                word != s.end && word !in allowed -> s.copy(reject = LadderReject.NOT_WORD)
                else -> accept(s, word, false, now)
            }
        }
        is LadderAction.Undo -> {
            if (s.words.size <= 1) s.copy(reject = null)
            else s.copy(words = s.words.dropLast(1), hintMask = s.hintMask.dropLast(1), events = s.events + "-", reject = null)
        }
        is LadderAction.Hint -> {
            val next = ladderNextStep(s.current, s.end, allowed, s.words.toSet()) ?: nextOnCanonicalPath(s)
            if (next == null) s.copy(reject = null) else accept(s, next, true, now)
        }
        is LadderAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/** What we store: solutions = [START, END, "par:N", "path:A,B,C"]; guesses = the event log. */
fun ladderMatchRow(s: LadderState): Pair<List<String>, List<String>> =
    listOf(s.start, s.end, "par:${s.par}", "path:${s.path.joinToString(",")}") to s.events

data class LadderReconstruction(
    val start: String, val end: String, val par: Int, val path: List<String>,
    val words: List<String>, val hintMask: String, val moves: Int, val hintsUsed: Int, val solved: Boolean,
)

/** Replay a matches row into the finished ladder, or null if malformed. */
fun reconstructLadder(solutions: List<String>, guesses: List<String>): LadderReconstruction? {
    if (solutions.size < 3) return null
    val start = solutions[0]; val end = solutions[1]
    if (!FIVE_UPPER.matches(start) || !FIVE_UPPER.matches(end)) return null
    val par = solutions[2].removePrefix("par:").toIntOrNull() ?: return null
    if (par < 1) return null
    val pathField = solutions.getOrNull(3) ?: ""
    val path = if (pathField.startsWith("path:") && pathField.length > 5) pathField.substring(5).split(",") else listOf(start, end)
    val words = arrayListOf(start); var hintMask = "0"; var moves = 0; var hintsUsed = 0
    for (ev in guesses) {
        if (ev == "-") { if (words.size > 1) { words.removeAt(words.size - 1); hintMask = hintMask.dropLast(1) }; continue }
        val sigil = ev.firstOrNull() ?: continue
        if (sigil != '+' && sigil != '?') continue
        val word = ev.substring(1)
        if (!FIVE_UPPER.matches(word)) continue
        words.add(word); hintMask += if (sigil == '?') "1" else "0"; moves++
        if (sigil == '?') hintsUsed++
    }
    return LadderReconstruction(start, end, par, path, words, hintMask, moves, hintsUsed, words.last() == end)
}
