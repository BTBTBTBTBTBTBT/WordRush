package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Hubbub — seven-letter hub game (More Games §12). 1:1 port of
 * packages/core/src/games/hub.ts; pinned by hub-fixtures.json (HubFixtureTest).
 * Words of 4+ letters using only the seven letters and containing the center;
 * 4 letters = 1 point, else length, pangram +7; bonus words score 0. Ranks by
 * integer maths (points*100 >= pct*max); Hubbub (50%) = solved. Play continues
 * after the win; End finalizes a loss when below Hubbub. Event sigils + = ? ! #
 */
const val HUB_DAILY_EPOCH = "2026-09-23"
const val HUB_LETTERS = 7
const val HUB_MIN_WORD = 4
const val HUB_TOTAL_BOARDS = 20
const val HUB_SOLVED_RANK = 6
val HUB_RANKS: List<Pair<String, Int>> = listOf(
    "Hush" to 0, "Murmur" to 5, "Chatter" to 12, "Banter" to 20, "Clamor" to 30, "Racket" to 40,
    "Hubbub" to 50, "Uproar" to 70, "Thunder" to 85, "Pandemonium" to 100,
)

@Serializable
data class HubPuzzle(val id: String, val letters: String, val words: List<String>, val bonus: List<String>, val pangrams: List<String>, val max: Int)

@Serializable
data class HubBank(val version: Int, val epoch: String, val daily: List<HubPuzzle>, val extra: List<HubPuzzle>) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): HubBank? = runCatching { json.decodeFromString<HubBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/hub-puzzles.json, sha-guarded to match the web copy). */
        val bundled: HubBank? by lazy {
            HubBank::class.java.classLoader?.getResourceAsStream("data/hub-puzzles.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

fun hubPuzzleForDay(bank: HubBank, day: String): HubPuzzle? = if (bank.daily.isEmpty()) null else bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]
fun hubPuzzleForSeed(bank: HubBank, seed: String): HubPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}
fun hubDailyNumber(day: String): Int { val idx = Bank.dayIndex(day, HUB_DAILY_EPOCH) ?: return 1; return maxOf(1, idx + 1) }

// ── Scoring ──────────────────────────────────────────────────────────────

fun hubIsPangram(word: String, letters: String): Boolean = letters.all { it in word }
fun hubWordScore(word: String, letters: String): Int = (if (word.length == 4) 1 else word.length) + (if (hubIsPangram(word, letters)) 7 else 0)
fun hubRankIndex(points: Int, max: Int): Int {
    if (max <= 0) return 0
    var i = 0
    for (k in HUB_RANKS.indices) if (points * 100 >= HUB_RANKS[k].second * max) i = k
    return i
}
fun hubRankThreshold(rank: Int, max: Int): Int = ((HUB_RANKS[rank].second * max) + 99) / 100
fun hubGuessCount(rankIndex: Int): Int = HUB_RANKS.size - rankIndex
fun hubBoardsSolved(points: Int, max: Int): Int = if (max <= 0) 0 else minOf(HUB_TOTAL_BOARDS, (points * HUB_TOTAL_BOARDS) / max)
fun hubStartsWithToken(word: String): String = "${word.take(2)}${word.length}"

// ── Reducer ──────────────────────────────────────────────────────────────

enum class HubStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }
enum class HubReject(val key: String) { ENDED("ended"), SHORT("short"), CENTRE("centre"), LETTERS("letters"), FOUND("found"), NOTWORD("notword") }

data class HubState(
    val seed: String, val id: String, val letters: String, val words: List<String>, val bonus: List<String>, val pangrams: List<String>, val max: Int,
    val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val hinted: List<String>,
    val points: Int, val hintsUsed: Int, val events: List<String>, val status: HubStatus, val ended: Boolean, val reject: HubReject?,
    val startTime: Long, val endTime: Long?,
) {
    val centre: Char get() = letters[0]
    val rank: Int get() = hubRankIndex(points, max)
    val rankName: String get() = HUB_RANKS[rank].first
    val guessCount: Int get() = hubGuessCount(rank)
    val boardsSolved: Int get() = hubBoardsSolved(points, max)
    fun nextUnfound(skipHinted: Boolean = false): String? = words.firstOrNull { it !in found && (!skipHinted || it !in hinted) }

    companion object {
        fun create(p: HubPuzzle, seed: String, startTime: Long) = HubState(
            seed, p.id, p.letters, p.words, p.bonus, p.pangrams, p.max, emptyList(), emptyList(), emptyList(), emptyList(),
            0, 0, emptyList(), HubStatus.PLAYING, false, null, startTime, null,
        )
    }
}

sealed class HubAction {
    data class Submit(val word: String) : HubAction()
    object HintStart : HubAction()
    object HintReveal : HubAction()
    object End : HubAction()
    object Finish : HubAction()
}

private fun settle(s: HubState, now: Long): HubState =
    if (s.status == HubStatus.PLAYING && s.rank >= HUB_SOLVED_RANK) s.copy(status = HubStatus.WON, endTime = now) else s

fun hubReduce(s: HubState, a: HubAction, now: Long = 0): HubState {
    if (a is HubAction.Finish) return if (s.status == HubStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.ended) return if (a is HubAction.Submit) s.copy(reject = HubReject.ENDED) else s
    return when (a) {
        is HubAction.Submit -> {
            val word = a.word.uppercase()
            when {
                word.length < HUB_MIN_WORD -> s.copy(reject = HubReject.SHORT)
                s.centre !in word -> s.copy(reject = HubReject.CENTRE)
                word.any { it !in s.letters } -> s.copy(reject = HubReject.LETTERS)
                word in s.found || word in s.bonusFound -> s.copy(reject = HubReject.FOUND)
                word in s.words -> settle(s.copy(found = s.found + word, points = s.points + hubWordScore(word, s.letters), events = s.events + "+$word", reject = null), now)
                word in s.bonus -> s.copy(bonusFound = s.bonusFound + word, events = s.events + "=$word", reject = null)
                else -> s.copy(reject = HubReject.NOTWORD)
            }
        }
        is HubAction.HintStart -> {
            val target = s.nextUnfound(skipHinted = true) ?: return s.copy(reject = null)
            s.copy(hinted = s.hinted + target, hintsUsed = s.hintsUsed + 1, events = s.events + "?${hubStartsWithToken(target)}", reject = null)
        }
        is HubAction.HintReveal -> {
            val target = s.nextUnfound() ?: return s.copy(reject = null)
            settle(s.copy(found = s.found + target, revealed = s.revealed + target, points = s.points + hubWordScore(target, s.letters), hintsUsed = s.hintsUsed + 2, events = s.events + "!$target", reject = null), now)
        }
        is HubAction.End -> {
            val n = s.copy(ended = true, events = s.events + "#", reject = null)
            if (n.status == HubStatus.PLAYING) n.copy(status = HubStatus.LOST, endTime = now) else n
        }
        is HubAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

fun hubMatchRow(s: HubState): Pair<List<String>, List<String>> =
    listOf(s.id, s.letters, "${s.max}", "${s.words.size}", "${s.pangrams.size}") to s.events

data class HubReconstruction(
    val id: String, val letters: String, val max: Int, val wordCount: Int, val pangramCount: Int,
    val found: List<String>, val bonusFound: List<String>, val revealed: List<String>, val hints: List<String>,
    val points: Int, val hintsUsed: Int, val rank: Int, val rankName: String, val ended: Boolean, val solved: Boolean,
)

fun reconstructHub(solutions: List<String>, guesses: List<String>): HubReconstruction? {
    if (solutions.size < 3) return null
    val letters = solutions[1]
    if (letters.length != 7 || !letters.all { it in 'A'..'Z' }) return null
    val max = solutions[2].toIntOrNull() ?: return null
    if (max <= 0) return null
    val found = ArrayList<String>(); val bonusFound = ArrayList<String>(); val revealed = ArrayList<String>(); val hints = ArrayList<String>()
    var points = 0; var hintsUsed = 0; var ended = false
    fun isWord(w: String) = w.length >= 4 && w.all { it in 'A'..'Z' }
    for (ev in guesses) {
        if (ev == "#") { ended = true; continue }
        val sigil = ev.firstOrNull() ?: continue
        val rest = ev.substring(1)
        when {
            (sigil == '+' || sigil == '!') && isWord(rest) && rest !in found -> { found.add(rest); points += hubWordScore(rest, letters); if (sigil == '!') { revealed.add(rest); hintsUsed += 2 } }
            sigil == '=' && isWord(rest) -> bonusFound.add(rest)
            sigil == '?' -> { hints.add(rest); hintsUsed += 1 }
        }
    }
    val rank = hubRankIndex(points, max)
    return HubReconstruction(solutions[0], letters, max, solutions.getOrNull(3)?.toIntOrNull() ?: 0, solutions.getOrNull(4)?.toIntOrNull() ?: 0,
        found, bonusFound, revealed, hints, points, hintsUsed, rank, HUB_RANKS[rank].first, ended, rank >= HUB_SOLVED_RANK)
}
