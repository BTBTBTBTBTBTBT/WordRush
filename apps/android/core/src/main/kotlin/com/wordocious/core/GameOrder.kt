package com.wordocious.core

/**
 * FRIDAY-QUEUE item 35: the player's own game order — a 1:1 port of packages/core/src/game-order.ts.
 * Display-only (sweep rules / db keys never change). Classic is pinned first in Dailies; unknown saved
 * ids are dropped; games missing from a saved order (new games) are appended in default order.
 */
data class GameOrderPrefs(val dailies: List<String> = emptyList(), val puzzles: List<String> = emptyList())

enum class GameOrderSection { DAILIES, PUZZLES }

object GameOrder {
    const val PINNED_FIRST_DAILY = "practice"

    /** Founder's default Dailies order (10-08): Classic, QuadWord, OctoWord, Succession, Six, Seven, Deliverance, Gauntlet. */
    val DEFAULT_DAILIES = listOf("practice", "quordle", "octordle", "sequence", "six", "seven", "rescue", "gauntlet")

    /** Default Puzzles order, easiest to hardest for now (Muddle moved down). */
    val DEFAULT_PUZZLES = listOf("propernoundle", "sudoku", "regions", "wordsearch", "ladder", "hub", "groups", "crossword", "cryptogram", "scramble")

    fun pinned(section: GameOrderSection): String? = if (section == GameOrderSection.DAILIES) PINNED_FIRST_DAILY else null

    fun apply(defaultIds: List<String>, saved: List<String>?, pinnedFirst: String?): List<String> {
        val known = defaultIds.toSet()
        val out = ArrayList<String>()
        val seen = HashSet<String>()
        for (id in saved.orEmpty()) if (id in known && seen.add(id)) out.add(id)
        for (id in defaultIds) if (seen.add(id)) out.add(id)
        if (pinnedFirst != null && pinnedFirst in known) return listOf(pinnedFirst) + out.filter { it != pinnedFirst }
        return out
    }

    /** Move one id from index [from] to [to]; the pinned slot-0 game can neither move nor be displaced. */
    fun move(order: List<String>, from: Int, to: Int, pinnedFirst: String?): List<String> {
        val next = order.toMutableList()
        if (from < 0 || from >= next.size || to < 0 || to >= next.size || from == to) return next
        val pinned = pinnedFirst?.let { next.indexOf(it) } ?: -1
        if (pinned == from) return next
        val id = next.removeAt(from)
        var dest = to
        if (pinned == 0 && dest == 0) dest = 1
        next.add(minOf(dest, next.size), id)
        return next
    }

    fun isDefault(defaultIds: List<String>, saved: List<String>?, pinnedFirst: String?): Boolean =
        apply(defaultIds, saved, pinnedFirst) == apply(defaultIds, null, pinnedFirst)

    /** Sanitize an untrusted saved value into prefs, or null when empty (lists capped at 40). */
    fun parse(dailies: List<String>?, puzzles: List<String>?): GameOrderPrefs? {
        val p = GameOrderPrefs(dailies.orEmpty().take(40), puzzles.orEmpty().take(40))
        return if (p.dailies.isEmpty() && p.puzzles.isEmpty()) null else p
    }

    /** Items sorted by a resolved id order (ids not in the order keep their relative place at the end). */
    fun <T> sortBy(items: List<T>, order: List<String>, idOf: (T) -> String): List<T> {
        val rank = order.withIndex().associate { it.value to it.index }
        return items.withIndex().sortedBy { rank[idOf(it.value)] ?: (1_000_000 + it.index) }.map { it.value }
    }

    /**
     * NEXT on a finished screen: the next game AFTER [currentId] in the player's order that is not
     * played yet, wrapping once; null when everything is played.
     */
    fun nextUnplayed(order: List<String>, currentId: String, played: Set<String>): String? {
        if (order.isEmpty()) return null
        val start = order.indexOf(currentId)
        for (step in 1..order.size) {
            val id = order[((start + step) % order.size + order.size) % order.size]
            if (id != currentId && id !in played) return id
        }
        return null
    }
}
