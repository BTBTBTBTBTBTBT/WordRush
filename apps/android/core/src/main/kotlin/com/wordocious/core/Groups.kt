package com.wordocious.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Kindred — groups of four (More Games §14). 1:1 port of
 * packages/core/src/games/groups.ts; pinned by groups-fixtures.json
 * (GroupsFixtureTest). Sixteen words hide four groups of four; find them all
 * with at most four mistakes. Tiers 1–4 run from a plain category to wordplay
 * and are shown as one to four pips on the solved bar (never color alone).
 * Submitting four words: a group → it locks and its bar appears; three from one
 * group → "One away"; otherwise a plain miss. A set already tried is free to
 * try again (no second mistake). Four mistakes lose the puzzle and the
 * remaining groups are revealed.
 *
 * Hints: NAME A CATEGORY (1 hint) shows the label of the easiest unsolved
 * group; SHOW A PAIR (2 hints) rings two words that belong together. Neither
 * costs a mistake.
 *
 * Result row: guess_count = submissions on a win (4 perfect … 7 worst) and
 * groups found + 4 on a loss; boards_solved = groups found of 4. Event sigils
 * (§11): "+t:W1,W2,W3,W4" solved tier t, "x1:…" one away, "x0:…" miss,
 * "=…" a repeated set (free), "?ct" category hint, "?p:A,B" pair hint,
 * "~n" shuffle n. Tile order comes from mulberry32(simpleHash(seed + "-groups-v1"))
 * so every platform deals the same board. On a holiday (§20) the daily comes
 * from the bank's own holiday list.
 */
const val GROUPS_DAILY_EPOCH = "2026-09-23"
const val GROUPS_MAX_MISTAKES = 4
const val GROUPS_TOTAL_BOARDS = 4
const val GROUPS_PERFECT_GUESSES = 4

@Serializable
data class GroupsGroup(val tier: Int, val label: String, val words: List<String>)

@Serializable
data class GroupsPuzzle(val id: String, val groups: List<GroupsGroup>, val holiday: String? = null)

@Serializable
data class GroupsBank(
    val version: Int, val epoch: String, val daily: List<GroupsPuzzle>, val extra: List<GroupsPuzzle>,
    val holiday: Map<String, List<GroupsPuzzle>>? = null,
) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun parse(text: String): GroupsBank? = runCatching { json.decodeFromString<GroupsBank>(text) }.getOrNull()
        /** The bundled bank (core resources/data/groups-puzzles.json, sha-guarded to match the web copy). */
        val bundled: GroupsBank? by lazy {
            GroupsBank::class.java.classLoader?.getResourceAsStream("data/groups-puzzles.json")?.bufferedReader()?.use { it.readText() }?.let { parse(it) }
        }
    }
}

/** The daily puzzle for [day]: the holiday's own entry when the calendar names one, else epoch-indexed. */
fun groupsPuzzleForDay(bank: GroupsBank, day: String, holidays: HolidayTable? = null): GroupsPuzzle? {
    val pick = bankHolidayPick(day, holidays, bank.holiday)
    if (pick != null) return pick.entry
    if (bank.daily.isEmpty()) return null
    return bank.daily[Bank.indexForDay(day, bank.daily.size, bank.epoch)]
}
fun groupsPuzzleForSeed(bank: GroupsBank, seed: String): GroupsPuzzle? {
    val pool = if (bank.extra.isEmpty()) bank.daily else bank.extra
    return if (pool.isEmpty()) null else pool[Bank.indexForSeed(seed, pool.size)]
}
fun groupsDailyNumber(day: String): Int { val idx = Bank.dayIndex(day, GROUPS_DAILY_EPOCH) ?: return 1; return maxOf(1, idx + 1) }

/**
 * Fisher–Yates from the end with j = rng() mod (i + 1) — the same shuffle on
 * every platform. [rng] yields the PRNG's unsigned 32-bit output as a Long
 * (what [Mulberry32.nextU32] returns), so the modulo never sees a negative Int.
 */
fun <T> groupsShuffle(items: List<T>, rng: () -> Long): List<T> {
    val a = ArrayList(items)
    for (i in a.size - 1 downTo 1) {
        val j = (rng() % (i + 1)).toInt()
        val tmp = a[i]; a[i] = a[j]; a[j] = tmp
    }
    return a
}
private fun groupsRng(key: String): () -> Long { val rng = Mulberry32(simpleHash(key)); return { rng.nextU32() } }

/** The sixteen words in puzzle order (tier 1 first), then dealt by the seed. */
fun groupsTileOrder(p: GroupsPuzzle, seed: String): List<String> {
    val words = p.groups.sortedBy { it.tier }.flatMap { it.words }
    return groupsShuffle(words, groupsRng("$seed-groups-v1"))
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class GroupsStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }
enum class GroupsResult(val key: String) { CORRECT("correct"), ONEAWAY("oneaway"), WRONG("wrong"), REPEAT("repeat"), SHORT("short") }

/** The pair a Show-a-pair hint would ring, and the tier it belongs to. */
data class GroupsPairTarget(val tier: Int, val pair: List<String>)

/**
 * [tiles]: unsolved words in display order. [solved]: groups in the order solved.
 * [revealedTiers]: tiers whose label has been revealed by a hint. [pairs]: pairs
 * shown by hints. [wrongSets]: sets already submitted and wrong ("A|B|C|D" sorted).
 */
data class GroupsState(
    val seed: String, val id: String, val groups: List<GroupsGroup>, val tiles: List<String>, val solved: List<GroupsGroup>,
    val selected: List<String>, val mistakes: Int, val submissions: Int, val hintsUsed: Int, val revealedTiers: List<Int>,
    val pairs: List<List<String>>, val wrongSets: List<String>, val shuffles: Int, val lastResult: GroupsResult?, val events: List<String>,
    val status: GroupsStatus, val ended: Boolean, val startTime: Long, val endTime: Long?,
) {
    val unsolved: List<GroupsGroup> get() = groupsUnsolved(this)
    val guessCount: Int get() = groupsGuessCount(this)
    val boardsSolved: Int get() = groupsBoardsSolved(this)
    val pairTarget: GroupsPairTarget? get() = groupsPairTarget(this)
    val labelTarget: GroupsGroup? get() = groupsLabelTarget(this)
}

sealed class GroupsAction {
    data class Toggle(val word: String) : GroupsAction()
    object Deselect : GroupsAction()
    object Shuffle : GroupsAction()
    object Submit : GroupsAction()
    object HintLabel : GroupsAction()
    object HintPair : GroupsAction()
    object Finish : GroupsAction()
}

fun createGroupsState(p: GroupsPuzzle, seed: String, startTime: Long): GroupsState {
    val groups = p.groups.sortedBy { it.tier }.map { GroupsGroup(it.tier, it.label, it.words.map { w -> w.uppercase() }) }
    return GroupsState(
        seed, p.id, groups, groupsTileOrder(GroupsPuzzle(p.id, groups, p.holiday), seed), emptyList(), emptyList(), 0, 0, 0,
        emptyList(), emptyList(), emptyList(), 0, null, emptyList(), GroupsStatus.PLAYING, false, startTime, null,
    )
}

private fun setKey(words: List<String>): String = words.sorted().joinToString("|")
fun groupsUnsolved(s: GroupsState): List<GroupsGroup> = s.groups.filter { g -> s.solved.none { it.tier == g.tier } }
/** guess_count for the result row: submissions on a win, groups found + 4 on a loss (in play, the current count). */
fun groupsGuessCount(s: GroupsState): Int {
    if (s.status == GroupsStatus.LOST) return s.solved.size + GROUPS_MAX_MISTAKES
    return maxOf(s.submissions, s.solved.size)
}
fun groupsBoardsSolved(s: GroupsState): Int = s.solved.size
/** The pair a Show-a-pair hint would ring: the two alphabetically first words of the easiest unsolved group not yet paired. */
fun groupsPairTarget(s: GroupsState): GroupsPairTarget? {
    for (g in groupsUnsolved(s)) {
        val words = g.words.sorted()
        if (s.pairs.any { p -> p[0] in words && p[1] in words }) continue
        return GroupsPairTarget(g.tier, listOf(words[0], words[1]))
    }
    return null
}
fun groupsLabelTarget(s: GroupsState): GroupsGroup? = groupsUnsolved(s).firstOrNull { it.tier !in s.revealedTiers }

fun groupsReduce(s: GroupsState, a: GroupsAction, now: Long = 0): GroupsState {
    if (a is GroupsAction.Finish) return if (s.status == GroupsStatus.PLAYING) s else s.copy(endTime = s.endTime ?: now)
    if (s.ended) return s
    return when (a) {
        is GroupsAction.Toggle -> {
            val w = a.word.uppercase()
            if (w !in s.tiles) return s
            if (w in s.selected) return s.copy(selected = s.selected.filter { it != w }, lastResult = null)
            if (s.selected.size >= 4) return s
            s.copy(selected = s.selected + w, lastResult = null)
        }
        is GroupsAction.Deselect -> if (s.selected.isNotEmpty()) s.copy(selected = emptyList(), lastResult = null) else s
        is GroupsAction.Shuffle -> {
            val n = s.shuffles + 1
            val tiles = groupsShuffle(s.tiles, groupsRng("${s.seed}-groups-shuffle-$n"))
            s.copy(tiles = tiles, shuffles = n, events = s.events + "~$n")
        }
        is GroupsAction.Submit -> {
            if (s.selected.size != 4) return s.copy(lastResult = GroupsResult.SHORT)
            val key = setKey(s.selected)
            if (key in s.wrongSets) return s.copy(lastResult = GroupsResult.REPEAT, events = s.events + "=${key.replace("|", ",")}")
            val unsolved = groupsUnsolved(s)
            val hit = unsolved.firstOrNull { g -> s.selected.all { it in g.words } }
            val submissions = s.submissions + 1
            if (hit != null) {
                val solved = s.solved + hit
                val tiles = s.tiles.filter { it !in hit.words }
                val won = solved.size == s.groups.size
                return s.copy(
                    solved = solved, tiles = tiles, selected = emptyList(), submissions = submissions, lastResult = GroupsResult.CORRECT,
                    events = s.events + "+${hit.tier}:${hit.words.joinToString(",")}",
                    status = if (won) GroupsStatus.WON else s.status, ended = won, endTime = if (won) now else s.endTime,
                )
            }
            val best = unsolved.maxOfOrNull { g -> s.selected.count { it in g.words } } ?: -1
            val oneAway = best == 3
            val mistakes = s.mistakes + 1
            val lost = mistakes >= GROUPS_MAX_MISTAKES
            s.copy(
                mistakes = mistakes, submissions = submissions, wrongSets = s.wrongSets + key,
                lastResult = if (oneAway) GroupsResult.ONEAWAY else GroupsResult.WRONG,
                selected = if (lost) emptyList() else s.selected,
                events = s.events + "${if (oneAway) "x1" else "x0"}:${s.selected.sorted().joinToString(",")}",
                status = if (lost) GroupsStatus.LOST else s.status, ended = lost, endTime = if (lost) now else s.endTime,
            )
        }
        is GroupsAction.HintLabel -> {
            val g = groupsLabelTarget(s) ?: return s
            s.copy(revealedTiers = s.revealedTiers + g.tier, hintsUsed = s.hintsUsed + 1, lastResult = null, events = s.events + "?c${g.tier}")
        }
        is GroupsAction.HintPair -> {
            val t = groupsPairTarget(s) ?: return s
            s.copy(pairs = s.pairs + listOf(t.pair), hintsUsed = s.hintsUsed + 2, lastResult = null, events = s.events + "?p:${t.pair.joinToString(",")}")
        }
        is GroupsAction.Finish -> s
    }
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/** solutions = ["tier|LABEL|W1,W2,W3,W4" × 4, tier order]; guesses = the event log. */
fun groupsMatchRow(s: GroupsState): Pair<List<String>, List<String>> =
    s.groups.map { "${it.tier}|${it.label}|${it.words.joinToString(",")}" } to s.events.toList()

/** [solvedTiers]: tiers in the order solved. */
data class GroupsReconstruction(
    val groups: List<GroupsGroup>, val solvedTiers: List<Int>, val mistakes: Int, val oneAways: Int, val submissions: Int,
    val hintsUsed: Int, val revealedTiers: List<Int>, val pairs: List<List<String>>, val solved: Boolean,
)

fun reconstructGroups(solutions: List<String>?, guesses: List<String>?): GroupsReconstruction? {
    if (solutions == null || solutions.size != 4) return null
    val groups = ArrayList<GroupsGroup>()
    for (sol in solutions) {
        val parts = sol.split("|")
        if (parts.size != 3) return null
        val tier = parts[0].trim().toIntOrNull() ?: return null
        val words = parts[2].split(",")
        if (tier !in 1..4 || words.size != 4) return null
        groups.add(GroupsGroup(tier, parts[1], words))
    }
    val solvedTiers = ArrayList<Int>(); val revealedTiers = ArrayList<Int>(); val pairs = ArrayList<List<String>>()
    var mistakes = 0; var oneAways = 0; var submissions = 0; var hintsUsed = 0
    for (ev in guesses ?: emptyList()) {
        if (ev.startsWith("+")) {
            // TS: Number(ev.slice(1, ev.indexOf(':'))) — a missing ':' slices to -1 (drops the last char).
            val colon = ev.indexOf(':')
            val end = if (colon < 0) maxOf(1, ev.length - 1) else colon
            val t = ev.substring(1, end).trim().toIntOrNull()
            if (t != null && t in 1..4 && t !in solvedTiers) solvedTiers.add(t)
            submissions++
        } else if (ev.startsWith("x1")) { mistakes++; oneAways++; submissions++ }
        else if (ev.startsWith("x0")) { mistakes++; submissions++ }
        else if (ev.startsWith("?c")) { val t = ev.substring(2).trim().toIntOrNull(); if (t != null && t in 1..4) revealedTiers.add(t); hintsUsed += 1 }
        else if (ev.startsWith("?p:")) { pairs.add(ev.substring(3).split(",")); hintsUsed += 2 }
    }
    return GroupsReconstruction(groups, solvedTiers, mistakes, oneAways, submissions, hintsUsed, revealedTiers, pairs, solvedTiers.size == 4)
}
