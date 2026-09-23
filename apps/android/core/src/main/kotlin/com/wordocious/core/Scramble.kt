package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Muddle — the newspaper scramble (More Games §5; catalog id `scramble`). 1:1
 * port of packages/core/src/games/scramble.ts; pinned by scramble-fixtures.json
 * (ScrambleFixtureTest). Four scrambled 5/6-letter words; the CIRCLED letters
 * of their answers, in word order, are exactly the letters of a pun that
 * completes the caption under the cartoon. Unscramble the four, then spell the
 * punchline.
 *
 * Play: letters are placed one at a time into the active word (tap a tile or
 * type — either way a letter must still be in that word's tray). When a word
 * is full it checks itself: right → it locks and its circled letters fly to the
 * punchline row; wrong → the row shakes, the letters go back, and a MISTAKE is
 * counted. Every check counts (guess_count = checks, perfect 5 = four words and
 * the punchline); thirteen checks lose. The punchline row opens once all four
 * words are solved and checks the same way. Hints never count as checks:
 * REVEAL_LETTER (1 hint) places the next correct letter, SOLVE_WORD (2 hints)
 * fills the word. boards_solved = words solved + punchline (0–5). Event sigils
 * (§11): "i✓WORD" solved, "i✗TRY" wrong, "ih<mask>" letter hint, "iH" word
 * solved by hint — i is 0–3 for the words, 4 for the punchline.
 *
 * `cartoon` is null until the founder's image batch runs; the apps show the
 * bundled placeholder panel and the caption meanwhile. On a holiday (§20) the
 * daily comes from the bank's own holiday list.
 */
const val SCRAMBLE_DAILY_EPOCH = "2026-09-23"
const val SCRAMBLE_MAX_CHECKS = 13
const val SCRAMBLE_TOTAL_BOARDS = 5
const val SCRAMBLE_WORDS = 4
const val SCRAMBLE_FINAL = 4

/** [circled]: indices into [answer] whose letters feed the punchline tray. */
@Serializable
data class ScrambleWord(val answer: String, val scramble: String, val circled: List<Int>)

/** [pattern]: the word lengths of the punchline (for the blanks under the cartoon). */
@Serializable
data class ScrambleFinal(val answer: String, val pattern: List<Int>)

@Serializable
data class ScramblePuzzle(
    val id: String, val words: List<ScrambleWord>, val final: ScrambleFinal, val caption: String, val altText: String,
    val cartoon: String? = null, val holiday: String? = null,
)

@Serializable
data class ScrambleBank(
    val version: Int, val epoch: String, val daily: List<ScramblePuzzle>, val extra: List<ScramblePuzzle>,
    val holiday: Map<String, List<ScramblePuzzle>>? = null,
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): ScrambleBank? = runCatching { json.decodeFromString<ScrambleBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/scramble-puzzles.json, sha-guarded to match the web copy). */
        val bundled: ScrambleBank? by lazy {
            ScrambleBank::class.java.classLoader?.getResourceAsStream("data/scramble-puzzles.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The daily puzzle for [day]: the holiday's own entry when the calendar names one, else epoch-indexed. */
fun scramblePuzzleForDay(bank: ScrambleBank, day: String, holidays: HolidayTable? = null): ScramblePuzzle? {
    val pick = bankHolidayPick(day, holidays, bank.holiday)
    if (pick != null) return pick.entry
    if (bank.daily.isEmpty()) return null
    return bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]
}
fun scramblePuzzleForSeed(bank: ScrambleBank, seed: String): ScramblePuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}
fun scrambleDailyNumber(day: String): Int { val idx = Bank.dayIndex(day, SCRAMBLE_DAILY_EPOCH) ?: return 1; return maxOf(1, idx + 1) }

// ── Helpers ──────────────────────────────────────────────────────────────

private val NOT_AZ = Regex("[^A-Z]")

/** The punchline's letters, no spaces. */
fun scrambleFinalLetters(final: ScrambleFinal): String = final.answer.replace(NOT_AZ, "")
fun scrambleFinalLetters(p: ScramblePuzzle): String = scrambleFinalLetters(p.final)
fun scrambleFinalLetters(s: ScrambleState): String = scrambleFinalLetters(s.final)
/** The punchline tray: the circled letters in word order (what the player spells from). */
fun scrambleFinalTray(words: List<ScrambleWord>): String {
    val sb = StringBuilder()
    for (w in words) for (i in w.circled) sb.append(w.answer[i])
    return sb.toString()
}
fun scrambleFinalTray(p: ScramblePuzzle): String = scrambleFinalTray(p.words)
fun scrambleFinalTray(s: ScrambleState): String = scrambleFinalTray(s.words)
/** Letters of [pool] not yet used by [entry] (multiset difference), in pool order. */
fun scrambleRemaining(pool: String, entry: String): String {
    val left = pool.toMutableList()
    for (ch in entry) { val k = left.indexOf(ch); if (k >= 0) left.removeAt(k) }
    return left.joinToString("")
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class ScrambleStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }
enum class ScrambleResult(val key: String) { CORRECT("correct"), WRONG("wrong") }

/**
 * [entries]: letters placed so far in each word (index 0–3) and the punchline (index 4).
 * [solved]: words solved (0–3) and the punchline (4).
 * [revealed]: positions filled by REVEAL_LETTER per row, as a mask of "_" / letter.
 * [lastRow] / [lastResult]: the row the last check judged and how (for the shake / fly animation).
 */
data class ScrambleState(
    val seed: String, val id: String, val words: List<ScrambleWord>, val final: ScrambleFinal, val caption: String,
    val entries: List<String>, val solved: List<Boolean>, val revealed: List<String>,
    val checks: Int, val mistakes: Int, val hintsUsed: Int, val lastRow: Int?, val lastResult: ScrambleResult?,
    val events: List<String>, val status: ScrambleStatus, val ended: Boolean, val startTime: Long, val endTime: Long?,
) {
    val finalOpen: Boolean get() = scrambleFinalOpen(this)
    val activeRow: Int? get() = scrambleActiveRow(this)
    val guessCount: Int get() = scrambleGuessCount(this)
    val boardsSolved: Int get() = scrambleBoardsSolved(this)
}

sealed class ScrambleAction {
    data class Type(val row: Int, val letter: String) : ScrambleAction()
    data class Back(val row: Int) : ScrambleAction()
    data class Clear(val row: Int) : ScrambleAction()
    data class RevealLetter(val row: Int) : ScrambleAction()
    data class SolveWord(val row: Int) : ScrambleAction()
    object Finish : ScrambleAction()
}

private fun blankMask(n: Int): String = "_".repeat(n)

fun createScrambleState(p: ScramblePuzzle, seed: String, startTime: Long): ScrambleState {
    val words = p.words.map { w -> ScrambleWord(w.answer.uppercase(), w.scramble.uppercase(), w.circled.toList()) }
    val final = ScrambleFinal(p.final.answer.uppercase(), p.final.pattern.toList())
    return ScrambleState(
        seed, p.id, words, final, p.caption,
        listOf("", "", "", "", ""), listOf(false, false, false, false, false),
        words.map { blankMask(it.answer.length) } + blankMask(scrambleFinalLetters(final).length),
        0, 0, 0, null, null, emptyList(), ScrambleStatus.PLAYING, false, startTime, null,
    )
}

/** The answer letters for a row (words: the answer; punchline: letters without spaces). */
fun scrambleTarget(s: ScrambleState, row: Int): String = if (row < SCRAMBLE_FINAL) s.words[row].answer else scrambleFinalLetters(s)
fun scrambleTarget(words: List<ScrambleWord>, final: ScrambleFinal, row: Int): String = if (row < SCRAMBLE_FINAL) words[row].answer else scrambleFinalLetters(final)
/** The tray a row draws from (words: the scramble; punchline: the circled letters in word order). */
fun scrambleTray(s: ScrambleState, row: Int): String = if (row < SCRAMBLE_FINAL) s.words[row].scramble else scrambleFinalTray(s)
fun scrambleTray(words: List<ScrambleWord>, row: Int): String = if (row < SCRAMBLE_FINAL) words[row].scramble else scrambleFinalTray(words)
/** True when the punchline row may be played (all four words solved). */
fun scrambleFinalOpen(s: ScrambleState): Boolean { for (i in 0 until SCRAMBLE_FINAL) if (!s.solved[i]) return false; return true }
/** The row the player should be working on: the first unsolved word, then the punchline. */
fun scrambleActiveRow(s: ScrambleState): Int? {
    for (i in 0 until SCRAMBLE_FINAL) if (!s.solved[i]) return i
    return if (s.solved[SCRAMBLE_FINAL]) null else SCRAMBLE_FINAL
}
/** guess_count for the result row: the checks made (at least 1); MAX_CHECKS on a loss. */
fun scrambleGuessCount(s: ScrambleState): Int = if (s.status == ScrambleStatus.LOST) SCRAMBLE_MAX_CHECKS else maxOf(1, s.checks)
fun scrambleBoardsSolved(s: ScrambleState): Int = s.solved.count { it }

private fun rowOk(s: ScrambleState, row: Int): Boolean =
    row >= 0 && row <= SCRAMBLE_FINAL && !s.solved[row] && (row < SCRAMBLE_FINAL || scrambleFinalOpen(s))
private fun <T> setAt(list: List<T>, i: Int, v: T): List<T> = list.mapIndexed { k, x -> if (k == i) v else x }
/** The mask's revealed letters, in order (what a cleared or wrong row keeps). */
private fun keptOf(mask: String): String = mask.filter { it != '_' }

private fun judge(s: ScrambleState, row: Int, now: Long): ScrambleState {
    val entry = s.entries[row]; val target = scrambleTarget(s, row)
    if (entry.length != target.length) return s
    val checks = s.checks + 1
    if (entry == target) {
        val solved = setAt(s.solved, row, true)
        val won = solved[SCRAMBLE_FINAL]
        return s.copy(
            solved = solved, checks = checks, lastRow = row, lastResult = ScrambleResult.CORRECT, events = s.events + "$row✓$target",
            status = if (won) ScrambleStatus.WON else s.status, ended = won, endTime = if (won) now else s.endTime,
        )
    }
    val mistakes = s.mistakes + 1
    val lost = checks >= SCRAMBLE_MAX_CHECKS
    // The wrong letters go back to the tray; revealed letters stay (and the whole row stays when the loss lands).
    val kept = keptOf(s.revealed[row])
    return s.copy(
        entries = setAt(s.entries, row, if (lost) entry else kept), checks = checks, mistakes = mistakes, lastRow = row, lastResult = ScrambleResult.WRONG,
        events = s.events + "$row✗$entry", status = if (lost) ScrambleStatus.LOST else s.status, ended = lost, endTime = if (lost) now else s.endTime,
    )
}

fun scrambleReduce(s: ScrambleState, a: ScrambleAction, now: Long = 0): ScrambleState {
    if (a is ScrambleAction.Finish) return if (s.status == ScrambleStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.ended) return s
    return when (a) {
        is ScrambleAction.Type -> {
            if (!rowOk(s, a.row)) return s
            val up = a.letter.uppercase()
            if (up.length != 1 || up[0] !in 'A'..'Z') return s
            val letter = up[0]
            val entry = s.entries[a.row]; val target = scrambleTarget(s, a.row)
            if (entry.length >= target.length) return s
            // The next position may be pinned by a revealed letter; only that letter fits there.
            val mask = s.revealed[a.row]
            val pinned = mask[entry.length]
            if (pinned != '_' && pinned != letter) return s
            if (pinned == '_' && letter !in scrambleRemaining(scrambleTray(s, a.row), entry)) return s
            judge(s.copy(entries = setAt(s.entries, a.row, entry + letter), lastRow = null, lastResult = null), a.row, now)
        }
        is ScrambleAction.Back -> {
            if (!rowOk(s, a.row) || s.entries[a.row].isEmpty()) return s
            val entry = s.entries[a.row]; val mask = s.revealed[a.row]
            // Step back over pinned (revealed) letters to the last letter the player placed.
            var k = entry.length - 1
            while (k >= 0 && mask[k] != '_') k--
            if (k < 0) return s
            s.copy(entries = setAt(s.entries, a.row, entry.substring(0, k)), lastRow = null, lastResult = null)
        }
        is ScrambleAction.Clear -> {
            if (!rowOk(s, a.row) || s.entries[a.row].isEmpty()) return s
            s.copy(entries = setAt(s.entries, a.row, keptOf(s.revealed[a.row])), lastRow = null, lastResult = null)
        }
        is ScrambleAction.RevealLetter -> {
            if (!rowOk(s, a.row)) return s
            val target = scrambleTarget(s, a.row); val mask = s.revealed[a.row]
            val pos = mask.indexOf('_')
            if (pos < 0) return s
            val newMask = mask.substring(0, pos) + target[pos] + mask.substring(pos + 1)
            // Rebuild the entry as the revealed prefix: everything typed after a wrong spot is returned to the tray.
            val entry = StringBuilder()
            for (i in 0 until target.length) { if (newMask[i] != '_') entry.append(newMask[i]) else break }
            val next = s.copy(
                revealed = setAt(s.revealed, a.row, newMask), entries = setAt(s.entries, a.row, entry.toString()), hintsUsed = s.hintsUsed + 1,
                lastRow = null, lastResult = null, events = s.events + "${a.row}h$newMask",
            )
            judge(next, a.row, now)
        }
        is ScrambleAction.SolveWord -> {
            if (!rowOk(s, a.row)) return s
            val target = scrambleTarget(s, a.row)
            val solved = setAt(s.solved, a.row, true)
            val won = solved[SCRAMBLE_FINAL]
            s.copy(
                entries = setAt(s.entries, a.row, target), revealed = setAt(s.revealed, a.row, target), solved = solved, hintsUsed = s.hintsUsed + 2,
                lastRow = a.row, lastResult = ScrambleResult.CORRECT, events = s.events + "${a.row}H",
                status = if (won) ScrambleStatus.WON else s.status, ended = won, endTime = if (won) now else s.endTime,
            )
        }
        is ScrambleAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/** solutions = [W1, W2, W3, W4, PUNCHLINE]; guesses = the event log. */
fun scrambleMatchRow(s: ScrambleState): Pair<List<String>, List<String>> =
    (s.words.map { it.answer } + s.final.answer) to s.events.toList()

/** [solvedByHint]: rows filled by SOLVE_WORD, in event order. */
data class ScrambleReconstruction(
    val words: List<String>, val final: String, val solved: List<Boolean>, val checks: Int, val mistakes: Int, val hintsUsed: Int,
    val solvedByHint: List<Int>, val boardsSolved: Int, val lost: Boolean, val won: Boolean,
)

private val SCRAMBLE_WORD_RE = Regex("^[A-Z]{5,6}$")
private val SCRAMBLE_FINAL_RE = Regex("^[A-Z ]+$")

fun reconstructScramble(solutions: List<String>?, guesses: List<String>?): ScrambleReconstruction? {
    if (solutions == null || solutions.size != 5) return null
    val words = solutions.subList(0, 4).toList(); val final = solutions[4]
    if (!words.all { SCRAMBLE_WORD_RE.matches(it) } || !SCRAMBLE_FINAL_RE.matches(final)) return null
    val solved = MutableList(5) { false }; val solvedByHint = ArrayList<Int>()
    var checks = 0; var mistakes = 0; var hintsUsed = 0
    for (ev in guesses ?: emptyList()) {
        // TS: Number(ev[0]) then 0 <= row <= 4 — anything but an ASCII digit 0–4 skips the event.
        val c = ev.firstOrNull() ?: continue
        if (c !in '0'..'4') continue
        val row = c - '0'
        val sig = ev.getOrNull(1)
        if (sig == '✓') { solved[row] = true; checks++ }
        else if (sig == '✗') { checks++; mistakes++ }
        else if (sig == 'h') hintsUsed += 1
        else if (sig == 'H') { solved[row] = true; hintsUsed += 2; solvedByHint.add(row) }
    }
    val won = solved[4]; val lost = !won && checks >= SCRAMBLE_MAX_CHECKS
    return ScrambleReconstruction(words, final, solved.toList(), checks, mistakes, hintsUsed, solvedByHint, solved.count { it }, lost, won)
}
