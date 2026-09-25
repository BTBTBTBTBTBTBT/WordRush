package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Codebreaker — cryptogram (More Games §16). 1:1 port of
 * packages/core/src/games/cryptogram.ts; pinned by cryptogram-fixtures.json
 * (CryptogramFixtureTest). A saying in a substitution cipher (a stored 26-letter
 * derangement per puzzle); the three most frequent letters are GIVEN and locked.
 * Letters are PENCIL, always: setting, changing and clearing are free. Two code
 * letters mapped to one plain letter conflict (red) and block completion; the
 * puzzle completes itself the moment every letter is right.
 * CHECK clears wrong letters and locks right ones (guess_count = min(checks, 3) + 1);
 * HINT reveals the most frequent unresolved code letter; REVEAL fills the answer
 * and records a loss. Event sigils: "=C:P" set, "-C" cleared, "#n" check with n
 * wrong, "?C" hint, "!" reveal. On a holiday (§20) the daily comes from the
 * bank's own holiday list.
 */
const val CRYPTOGRAM_DAILY_EPOCH = "2026-09-23"
const val CRYPTOGRAM_MAX_CHECKS = 3
const val CRYPTOGRAM_REVEAL_AFTER_SECONDS = 300
const val CRYPTOGRAM_TOTAL_BOARDS = 1
const val CRYPTOGRAM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** [key]: 26 uppercase letters, key[i] is the CODE letter for plain letter ALPHABET[i]. [given]: plain letters locked from the start. */
@Serializable
data class CryptogramPuzzle(val id: String, val text: String, val key: String, val given: List<String>, val holiday: String? = null)

@Serializable
data class CryptogramBank(
    val version: Int, val epoch: String, val daily: List<CryptogramPuzzle>, val extra: List<CryptogramPuzzle>,
    val holiday: Map<String, List<CryptogramPuzzle>>? = null,
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): CryptogramBank? = runCatching { json.decodeFromString<CryptogramBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/cryptogram-puzzles.json, sha-guarded to match the web copy). */
        val bundled: CryptogramBank? by lazy {
            CryptogramBank::class.java.classLoader?.getResourceAsStream("data/cryptogram-puzzles.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The saying enciphered: letters mapped through the key, everything else kept. */
fun cryptogramEncipher(text: String, key: String): String {
    val out = StringBuilder()
    for (ch in text.uppercase()) {
        val i = CRYPTOGRAM_ALPHABET.indexOf(ch)
        out.append(if (i >= 0) key[i] else ch)
    }
    return out.toString()
}
/** The plain letter a CODE letter stands for ("" if the key lacks it). */
fun cryptogramPlainFor(code: String, key: String): String {
    val i = key.indexOf(code)
    return if (i >= 0) CRYPTOGRAM_ALPHABET[i].toString() else ""
}
/** The CODE letter for a plain letter ("" if not a letter). */
fun cryptogramCodeFor(plain: String, key: String): String {
    val i = CRYPTOGRAM_ALPHABET.indexOf(plain)
    return if (i >= 0) key[i].toString() else ""
}
/** Distinct code letters that occur in the cipher text, alphabetical. */
fun cryptogramCodeLetters(cipher: String): List<String> {
    val set = LinkedHashSet<String>()
    for (ch in cipher) if (ch in CRYPTOGRAM_ALPHABET) set.add(ch.toString())
    return set.sorted()
}
/** Occurrences of each code letter in the cipher text (the frequency strip). */
fun cryptogramFrequencies(cipher: String): Map<String, Int> {
    val out = LinkedHashMap<String, Int>()
    for (ch in cipher) if (ch in CRYPTOGRAM_ALPHABET) out[ch.toString()] = (out[ch.toString()] ?: 0) + 1
    return out
}

/** The daily puzzle for [day]: the holiday's own entry when the calendar names one, else epoch-indexed. */
fun cryptogramPuzzleForDay(bank: CryptogramBank, day: String, holidays: HolidayTable? = null): CryptogramPuzzle? {
    val pick = bankHolidayPick(day, holidays, bank.holiday)
    if (pick != null) return pick.entry
    if (bank.daily.isEmpty()) return null
    return bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]
}
fun cryptogramPuzzleForSeed(bank: CryptogramBank, seed: String): CryptogramPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}
fun cryptogramDailyNumber(day: String): Int { val idx = Bank.dayIndex(day, CRYPTOGRAM_DAILY_EPOCH) ?: return 1; return maxOf(1, idx + 1) }

// ── Reducer ──────────────────────────────────────────────────────────────

enum class CryptogramStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }

/**
 * [mapping]: code letter → the plain letter the player has penciled in.
 * [locked]: code letters that can no longer change (given, checked-correct, hinted, revealed), alphabetical.
 * [hinted]: code letters filled by Hint, in order. [lastWrong]: code letters the last Check cleared.
 */
data class CryptogramState(
    val seed: String, val id: String, val text: String, val key: String, val cipher: String, val given: List<String>,
    val mapping: Map<String, String>, val locked: List<String>, val hinted: List<String>,
    val hintsUsed: Int, val checks: Int, val lastWrong: List<String>, val events: List<String>,
    val status: CryptogramStatus, val ended: Boolean, val startTime: Long, val endTime: Long?,
) {
    val guessCount: Int get() = cryptogramGuessCount(checks)
    val conflicts: List<String> get() = cryptogramConflicts(mapping)
    val correctCount: Int get() = cryptogramCorrectCount(cipher, key, mapping)
    val hintTarget: String? get() = cryptogramHintTarget(this)
    val solved: Boolean get() = cryptogramIsSolved(cipher, key, mapping)
}

sealed class CryptogramAction {
    /** Pencil [plain] in for code letter [code]; null or "" clears it. */
    data class Set(val code: String, val plain: String?) : CryptogramAction()
    object Check : CryptogramAction()
    object Hint : CryptogramAction()
    object Reveal : CryptogramAction()
    object Finish : CryptogramAction()
}

fun createCryptogramState(p: CryptogramPuzzle, seed: String, startTime: Long): CryptogramState {
    val cipher = cryptogramEncipher(p.text, p.key)
    val mapping = LinkedHashMap<String, String>()
    val locked = ArrayList<String>()
    for (plain in p.given) {
        val code = cryptogramCodeFor(plain, p.key)
        if (code.isNotEmpty() && code in cipher) { mapping[code] = plain; locked.add(code) }
    }
    return CryptogramState(
        seed, p.id, p.text, p.key, cipher, p.given.toList(), mapping, locked.sorted(), emptyList(),
        0, 0, emptyList(), emptyList(), CryptogramStatus.PLAYING, false, startTime, null,
    )
}

/** True when every code letter in the text is mapped to its true plain letter. */
fun cryptogramIsSolved(cipher: String, key: String, mapping: Map<String, String>): Boolean {
    for (code in cryptogramCodeLetters(cipher)) if (mapping[code] != cryptogramPlainFor(code, key)) return false
    return true
}
/** Plain letters used for more than one code letter (shown red; block completion by definition). */
fun cryptogramConflicts(mapping: Map<String, String>): List<String> {
    val seen = LinkedHashMap<String, Int>()
    for (p in mapping.values) seen[p] = (seen[p] ?: 0) + 1
    return seen.keys.filter { seen[it]!! > 1 }.sorted()
}
/** Code letters in the text right now correct (mapped to the truth). */
fun cryptogramCorrectCount(cipher: String, key: String, mapping: Map<String, String>): Int {
    var n = 0
    for (code in cryptogramCodeLetters(cipher)) if (mapping[code] == cryptogramPlainFor(code, key)) n++
    return n
}
/** guess_count for the result row: no Check = 1, capped at MAX_CHECKS + 1. */
fun cryptogramGuessCount(checks: Int): Int = minOf(checks, CRYPTOGRAM_MAX_CHECKS) + 1

/** The Hint target: the most frequent code letter not yet correct-and-locked; ties alphabetical. */
fun cryptogramHintTarget(s: CryptogramState): String? {
    val freq = cryptogramFrequencies(s.cipher)
    var best: String? = null
    for (code in cryptogramCodeLetters(s.cipher)) {
        if (code in s.locked && s.mapping[code] == cryptogramPlainFor(code, s.key)) continue
        if (best == null || freq[code]!! > freq[best]!! || (freq[code] == freq[best] && code < best)) best = code
    }
    return best
}

private fun settle(s: CryptogramState, now: Long): CryptogramState =
    if (s.status == CryptogramStatus.PLAYING && s.solved) s.copy(status = CryptogramStatus.WON, ended = true, endTime = now) else s
private fun addLocked(locked: List<String>, code: String): List<String> = if (code in locked) locked else (locked + code).sorted()

fun cryptogramReduce(s: CryptogramState, a: CryptogramAction, now: Long = 0): CryptogramState {
    if (a is CryptogramAction.Finish) return if (s.status == CryptogramStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.ended) return s
    return when (a) {
        is CryptogramAction.Set -> {
            val code = a.code.uppercase()
            if (code !in CRYPTOGRAM_ALPHABET || code !in s.cipher || code in s.locked) return s
            val mapping = LinkedHashMap(s.mapping)
            if (a.plain == null || a.plain == "") {
                if (code !in mapping) return s
                mapping.remove(code)
                return s.copy(mapping = mapping, lastWrong = emptyList(), events = s.events + "-$code")
            }
            val plain = a.plain.uppercase()
            if (plain !in CRYPTOGRAM_ALPHABET || plain.length != 1) return s
            if (mapping[code] == plain) return s
            mapping[code] = plain
            settle(s.copy(mapping = mapping, lastWrong = emptyList(), events = s.events + "=$code:$plain"), now)
        }
        is CryptogramAction.Check -> {
            val mapping = LinkedHashMap(s.mapping)
            var locked = s.locked
            val wrong = ArrayList<String>()
            for (code in mapping.keys.sorted()) {
                if (mapping[code] == cryptogramPlainFor(code, s.key)) locked = addLocked(locked, code)
                else { mapping.remove(code); wrong.add(code) }
            }
            s.copy(mapping = mapping, locked = locked, checks = s.checks + 1, lastWrong = wrong, events = s.events + "#${wrong.size}")
        }
        is CryptogramAction.Hint -> {
            val code = cryptogramHintTarget(s) ?: return s
            val mapping = LinkedHashMap(s.mapping); mapping[code] = cryptogramPlainFor(code, s.key)
            settle(s.copy(
                mapping = mapping, locked = addLocked(s.locked, code), hinted = s.hinted + code, hintsUsed = s.hintsUsed + 1,
                lastWrong = emptyList(), events = s.events + "?$code",
            ), now)
        }
        is CryptogramAction.Reveal -> {
            val mapping = LinkedHashMap<String, String>()
            val codes = cryptogramCodeLetters(s.cipher)
            for (code in codes) mapping[code] = cryptogramPlainFor(code, s.key)
            s.copy(mapping = mapping, locked = codes, lastWrong = emptyList(), events = s.events + "!", status = CryptogramStatus.LOST, ended = true, endTime = now)
        }
        is CryptogramAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/**
 * solutions = [text, key26, id]; guesses = ["=" + mapping26, "h" + mask26, "c" + checks]
 * where position i of each 26-string is CODE letter ALPHABET[i]: mapping26 holds
 * the penciled plain letter or "."; mask26 holds "g" given, "h" hinted, "r"
 * revealed, "l" locked by a Check, "." otherwise.
 */
fun cryptogramMatchRow(s: CryptogramState): Pair<List<String>, List<String>> {
    val mapping26 = StringBuilder(); val mask26 = StringBuilder()
    val givenCodes = s.given.map { cryptogramCodeFor(it, s.key) }
    val revealed = s.status == CryptogramStatus.LOST && "!" in s.events
    for (ch in CRYPTOGRAM_ALPHABET) {
        val code = ch.toString()
        mapping26.append(s.mapping[code] ?: ".")
        mask26.append(
            when {
                ch !in s.cipher -> '.'
                code in givenCodes -> 'g'
                code in s.hinted -> 'h'
                revealed -> 'r'
                code in s.locked -> 'l'
                else -> '.'
            },
        )
    }
    return listOf(s.text, s.key, s.id) to listOf("=$mapping26", "h$mask26", "c${s.checks}")
}

data class CryptogramReconstruction(
    val id: String, val text: String, val key: String, val cipher: String,
    val mapping: Map<String, String>, val given: List<String>, val hinted: List<String>, val revealed: Boolean, val checks: Int,
    val correct: Int, val total: Int, val solved: Boolean,
)

fun reconstructCryptogram(solutions: List<String>?, guesses: List<String>?): CryptogramReconstruction? {
    if (solutions == null || solutions.size < 2) return null
    val text = solutions[0]; val key = solutions[1]; val id = solutions.getOrNull(2) ?: ""
    if (text.isEmpty() || key.length != 26 || !key.all { it in 'A'..'Z' } || key.toSet().size != 26) return null
    val cipher = cryptogramEncipher(text, key)
    val mapping = LinkedHashMap<String, String>(); val given = ArrayList<String>(); val hinted = ArrayList<String>()
    var revealed = false; var checks = 0
    for (g in guesses ?: emptyList()) {
        val sigil = g.firstOrNull() ?: continue
        if (sigil == '=' && g.length == 27) { for (i in 0 until 26) if (g[i + 1] != '.') mapping[CRYPTOGRAM_ALPHABET[i].toString()] = g[i + 1].toString() }
        else if (sigil == 'h' && g.length == 27) { for (i in 0 until 26) { val c = g[i + 1]; val code = CRYPTOGRAM_ALPHABET[i].toString(); if (c == 'g') given.add(cryptogramPlainFor(code, key)) else if (c == 'h') hinted.add(code) else if (c == 'r') revealed = true } }
        else if (sigil == 'c') checks = maxOf(0, g.substring(1).trim().toIntOrNull() ?: 0)
    }
    val total = cryptogramCodeLetters(cipher).size
    val correct = cryptogramCorrectCount(cipher, key, mapping)
    return CryptogramReconstruction(id, text, key, cipher, mapping, given, hinted, revealed, checks, correct, total, !revealed && correct == total)
}
