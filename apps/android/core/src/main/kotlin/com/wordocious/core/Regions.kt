package com.wordocious.core

import kotlin.math.abs

/**
 * Starsweep — region-placement logic puzzle (More Games §18b). 1:1 port of
 * packages/core/src/games/regions.ts; pinned by regions-fixtures.json
 * (RegionsFixtureTest). Everything is integer arithmetic over
 * Mulberry32(simpleHash(seed + "-regions-v1[-r<k>]")), so the same seed yields
 * the same board on every platform.
 *
 * Strings: `regions` is n*n chars (region index per cell), `solution` is n
 * chars (the star's column per row), `board` is n*n chars: '.' empty, 'x'
 * crossed out, '*' star.
 */
const val REGIONS_MAX_MISTAKES = 3
const val REGIONS_DAILY_EPOCH = "2026-09-23"
private const val REGIONS_MAX_REROLLS = 400
private const val REGIONS_HISTORY_CAP = 200

data class RegionsPuzzle(val seed: String, val n: Int, val regions: String, val solution: String, val sizes: List<Int>, val rerolls: Int)

// ── PRNG helpers (rng call ORDER is the parity contract) ─────────────────

private fun below(rng: Mulberry32, n: Int): Int = (rng.nextU32() % n).toInt()
private fun <T> shuffleR(rng: Mulberry32, arr: List<T>): List<T> {
    val a = arr.toMutableList()
    for (i in a.size - 1 downTo 1) { val j = below(rng, i + 1); val t = a[i]; a[i] = a[j]; a[j] = t }
    return a
}

/** Orthogonal neighbors, in the fixed order up, down, left, right. */
fun regionsN4(n: Int, i: Int): List<Int> {
    val r = i / n; val c = i % n
    val o = ArrayList<Int>(4)
    if (r > 0) o.add(i - n)
    if (r < n - 1) o.add(i + n)
    if (c > 0) o.add(i - 1)
    if (c < n - 1) o.add(i + 1)
    return o
}

// ── Generator ────────────────────────────────────────────────────────────

private fun layout(n: Int, rng: Mulberry32): List<Int>? {
    val cols = ArrayList<Int>()
    fun go(r: Int): Boolean {
        if (r == n) return true
        for (c in shuffleR(rng, (0 until n).toList())) {
            if (cols.contains(c) || (r > 0 && abs(cols[r - 1] - c) < 2)) continue
            cols.add(c)
            if (go(r + 1)) return true
            cols.removeAt(cols.size - 1)
        }
        return false
    }
    return if (go(0)) cols else null
}

private fun grow(n: Int, cols: List<Int>, rng: Mulberry32): IntArray {
    val reg = IntArray(n * n) { -1 }
    cols.forEachIndexed { r, c -> reg[r * n + c] = r }
    val weight = cols.map { 1 + below(rng, 4) }
    var left = n * n - n
    while (left > 0) {
        val k = below(rng, n)
        if (below(rng, 4) >= weight[k]) continue
        val edge = ArrayList<Int>()
        for (i in reg.indices) if (reg[i] == k) for (j in regionsN4(n, i)) if (reg[j] < 0) edge.add(j)
        if (edge.isEmpty()) continue
        reg[edge[below(rng, edge.size)]] = k
        left--
    }
    return reg
}

/** Number of solutions (stopping at [limit]); [keep] collects them as column lists. */
fun countRegionsSolutions(n: Int, reg: IntArray, limit: Int = 2, keep: MutableList<List<Int>>? = null): Int {
    val usedC = BooleanArray(n); val usedR = BooleanArray(n); val cur = ArrayList<Int>()
    var count = 0
    fun go(r: Int) {
        if (r == n) { count++; keep?.add(cur.toList()); return }
        var c = 0
        while (c < n && count < limit) {
            val g = reg[r * n + c]
            if (!(usedC[c] || usedR[g] || (r > 0 && abs(cur[r - 1] - c) < 2))) {
                usedC[c] = true; usedR[g] = true; cur.add(c)
                go(r + 1)
                cur.removeAt(cur.size - 1); usedC[c] = false; usedR[g] = false
            }
            c++
        }
    }
    go(0)
    return count
}

private fun connected(n: Int, reg: IntArray, k: Int, without: Int): Boolean {
    val cells = ArrayList<Int>()
    for (i in reg.indices) if (reg[i] == k && i != without) cells.add(i)
    if (cells.isEmpty()) return false
    val seen = HashSet<Int>().apply { add(cells[0]) }; val q = ArrayList<Int>().apply { add(cells[0]) }
    while (q.isNotEmpty()) {
        val cur = q.removeAt(q.size - 1)
        for (j in regionsN4(n, cur)) if (reg[j] == k && j != without && !seen.contains(j)) { seen.add(j); q.add(j) }
    }
    return seen.size == cells.size
}

/** The board for a seed and size; null only if 400 attempts all fail. */
fun generateRegions(seed: String, n: Int): RegionsPuzzle? {
    for (k in 0 until REGIONS_MAX_REROLLS) {
        val rng = Mulberry32(simpleHash("$seed-regions-v1${if (k > 0) "-r$k" else ""}"))
        val cols = layout(n, rng) ?: continue
        val reg = grow(n, cols, rng)
        var step = 0
        while (step < 60 && countRegionsSolutions(n, reg) > 1) {
            val all = ArrayList<List<Int>>()
            countRegionsSolutions(n, reg, 2, all)
            val rival = all.firstOrNull { s -> s.withIndex().any { (r, c) -> c != cols[r] } } ?: break
            val moves = ArrayList<Pair<Int, Int>>()
            rival.forEachIndexed { r, c ->
                val i = r * n + c
                if (c != cols[r]) for (j in regionsN4(n, i)) if (reg[j] != reg[i] && connected(n, reg, reg[i], i)) moves.add(i to reg[j])
            }
            if (moves.isEmpty()) break
            val (i, to) = moves[below(rng, moves.size)]
            reg[i] = to
            step++
        }
        val sizes = IntArray(n)
        for (v in reg) sizes[v]++
        if (countRegionsSolutions(n, reg) != 1 || sizes.count { it <= 2 } > 1 || (sizes.maxOrNull() ?: 0) > n * 2 ||
            (0 until n).any { !connected(n, reg, it, -1) }) continue
        val order = ArrayList<Int>()
        for (v in reg) if (!order.contains(v)) order.add(v)
        return RegionsPuzzle(seed, n, reg.joinToString("") { order.indexOf(it).toString() }, cols.joinToString(""), order.map { sizes[it] }, k)
    }
    return null
}

/** Daily board size: 7×7 Monday–Wednesday, 8×8 Thursday–Sunday (local day string). */
fun regionsSizeForDay(day: String): Int {
    val d = runCatching { java.time.LocalDate.parse(day) }.getOrNull() ?: return 8
    val dow = d.dayOfWeek.value % 7   // 0 = Sunday … 6 = Saturday (java: Monday=1..Sunday=7)
    return if (dow in 1..3) 7 else 8
}

/** Size encoded in an Unlimited seed's trailing segment (`-7`/`-8`/`-9`); default 8. */
fun regionsSizeForSeed(seed: String): Int = when (seed.split("-").lastOrNull()) { "7" -> 7; "9" -> 9; else -> 8 }

/** "#N" for the daily on [day]; 1 on the epoch day, never below 1. */
fun regionsDailyNumber(day: String): Int {
    val idx = Bank.dayIndex(day, REGIONS_DAILY_EPOCH) ?: return 1
    return maxOf(1, idx + 1)
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class RegionsStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }

/** [autoMask]: '1' where an × was drawn by Auto-cross; "" (old saves) = every × hand-placed. */
data class RegionsSnapshot(val board: String, val hintMask: String, val wrongMask: String, val autoMask: String = "")

data class RegionsState(
    val seed: String, val n: Int, val regions: String, val solution: String,
    val board: String, val hintMask: String, val wrongMask: String,
    val mistakes: Int, val hintsUsed: Int, val autoCross: Boolean,
    val status: RegionsStatus, val history: List<RegionsSnapshot>, val startTime: Long, val endTime: Long?,
    /** '1' where an × was drawn by Auto-cross (withdrawn when the star that drew it goes); "" (old saves) = none. */
    val autoMask: String = "",
) {
    /** [autoMask], padded for saves from before black stars. */
    val autoMaskOrBlank: String get() = if (autoMask.length == n * n) autoMask else "0".repeat(n * n)
    val snapshot: RegionsSnapshot get() = RegionsSnapshot(board, hintMask, wrongMask, autoMaskOrBlank)
    companion object {
        fun create(p: RegionsPuzzle, startTime: Long): RegionsState = RegionsState(
            p.seed, p.n, p.regions, p.solution, ".".repeat(p.n * p.n), "0".repeat(p.n * p.n), "0".repeat(p.n * p.n),
            0, 0, true, RegionsStatus.PLAYING, emptyList(), startTime, null, "0".repeat(p.n * p.n),
        )
    }
}

sealed class RegionsAction {
    /** empty → black star → × → empty; a committed star → ×. */
    data class Tap(val cell: Int) : RegionsAction()
    /** Double tap: judge the star (purple or red); on an empty cell, place and judge. */
    data class Commit(val cell: Int) : RegionsAction()
    data class Erase(val cell: Int) : RegionsAction()
    object Undo : RegionsAction()
    data class Hint(val cell: Int? = null) : RegionsAction()
    data class SetAutoCross(val value: Boolean) : RegionsAction()
    /** Re-check win/loss (a restored save that is already solved finishes). */
    object Settle : RegionsAction()
    data class Finish(val now: Long) : RegionsAction()
}

private fun setChar(s: String, i: Int, ch: Char): String = s.substring(0, i) + ch + s.substring(i + 1)
private fun starOfRow(s: RegionsState, r: Int): Int = r * s.n + (s.solution[r] - '0')
private fun isStarCell(s: RegionsState, i: Int): Boolean = starOfRow(s, i / s.n) == i
private fun pushHistory(s: RegionsState): List<RegionsSnapshot> {
    val h = s.history + s.snapshot
    return if (h.size > REGIONS_HISTORY_CAP) h.takeLast(REGIONS_HISTORY_CAP) else h
}

/**
 * Starsweep region colors (founder 10-12: two touching greens read as one). Nine hues in a fixed order; how far
 * apart each pair reads on a dark board, CIEDE2000 rounded (the web palette test recomputes it). Port of regions.ts.
 */
val REGION_COLOR_DIST: List<List<Int>> = listOf(
    listOf(0, 48, 53, 22, 71, 26, 45, 33, 29),
    listOf(48, 0, 38, 44, 25, 36, 42, 25, 29),
    listOf(53, 38, 0, 44, 24, 59, 25, 62, 29),
    listOf(22, 44, 44, 0, 63, 32, 27, 42, 20),
    listOf(71, 25, 24, 63, 0, 57, 39, 52, 37),
    listOf(26, 36, 59, 32, 57, 0, 47, 24, 21),
    listOf(45, 42, 25, 27, 39, 47, 0, 65, 23),
    listOf(33, 25, 62, 42, 52, 24, 65, 0, 33),
    listOf(29, 29, 29, 20, 37, 21, 23, 33, 0),
)

/**
 * Which palette color each region wears: one of the first min(regions, 9) colors, none repeated, so touching regions
 * read as far apart as possible (greedy start + the plain order, each improved by pair swaps; the better one wins,
 * greedy on a tie). Exact port of `regionColorSlots` in regions.ts. [regions] is one digit char per cell.
 */
fun regionColorSlots(n: Int, regions: String): List<Int> {
    var count = 0
    for (ch in regions) count = maxOf(count, ch.code - 47)
    val palette = REGION_COLOR_DIST.size
    val k = minOf(count, palette)
    val nb = Array(count) { BooleanArray(count) }
    for (i in 0 until minOf(n * n, regions.length)) {
        val g = regions[i].code - 48
        if (i % n < n - 1 && i + 1 < regions.length) { val h = regions[i + 1].code - 48; if (h != g) { nb[g][h] = true; nb[h][g] = true } }
        if (i + n < regions.length) { val h = regions[i + n].code - 48; if (h != g) { nb[g][h] = true; nb[h][g] = true } }
    }
    val degree = IntArray(count) { g -> nb[g].count { it } }
    val order = (0 until count).sortedWith { a, b -> if (degree[a] != degree[b]) degree[b] - degree[a] else a - b }
    val greedy = IntArray(count) { -1 }
    val used = BooleanArray(maxOf(k, 0))
    for (g in order) {
        if (g >= k) { greedy[g] = g % palette; continue }
        var best = -1; var bestScore = -1
        for (c in 0 until k) {
            if (used[c]) continue
            var score = 1000
            for (h in 0 until count) if (nb[g][h] && greedy[h] >= 0) score = minOf(score, REGION_COLOR_DIST[c][greedy[h]])
            if (score > bestScore) { bestScore = score; best = c }
        }
        greedy[g] = best; used[best] = true
    }
    fun grade(slot: IntArray): Pair<Int, Int> {
        var lo = 1000; var sum = 0
        for (g in 0 until count) for (h in g + 1 until count) if (nb[g][h]) { val d = REGION_COLOR_DIST[slot[g]][slot[h]]; lo = minOf(lo, d); sum += d }
        return lo to sum
    }
    fun better(a: Pair<Int, Int>, b: Pair<Int, Int>) = a.first > b.first || (a.first == b.first && a.second > b.second)
    fun improve(start: IntArray): IntArray {
        val slot = start.copyOf()
        var cur = grade(slot); var moved = true
        while (moved) {
            moved = false
            for (i in 0 until k) for (j in i + 1 until k) {
                val t = slot[i]; slot[i] = slot[j]; slot[j] = t
                val g = grade(slot)
                if (better(g, cur)) { cur = g; moved = true } else { val u = slot[i]; slot[i] = slot[j]; slot[j] = u }
            }
        }
        return slot
    }
    val a = improve(greedy)
    val b = improve(IntArray(count) { it % palette })
    return (if (better(grade(b), grade(a))) b else a).toList()
}

/** Cells a star rules out: its row, column, region and the eight neighbors. */
fun regionsRuledOut(n: Int, regions: String, cell: Int): List<Int> {
    val r = cell / n; val c = cell % n; val g = regions[cell]
    val out = HashSet<Int>()
    for (k in 0 until n) { out.add(r * n + k); out.add(k * n + c) }
    for (i in 0 until n * n) if (regions[i] == g) out.add(i)
    for (dr in -1..1) for (dc in -1..1) { val rr = r + dr; val cc = c + dc; if (rr in 0 until n && cc in 0 until n) out.add(rr * n + cc) }
    out.remove(cell)
    return out.sorted()
}

/** Auto-cross: × every still-empty cell, marking it as auto-drawn. */
private fun crossOut(board: String, autoMask: String, cells: List<Int>): Pair<String, String> {
    val a = board.toCharArray(); val m = autoMask.toCharArray()
    for (i in cells) if (a[i] == '.') { a[i] = 'x'; m[i] = '1' }
    return String(a) to String(m)
}

/**
 * Withdraw auto-drawn ×s that no remaining black or purple star rules out (a red or removed
 * star takes its ×s with it — founder, 2026-09-28). Hand ×s stay.
 */
private fun withdrawCrosses(s: RegionsState, board: String, autoMask: String, wrongMask: String): Pair<String, String> {
    val a = board.toCharArray(); val m = autoMask.toCharArray()
    val keep = HashSet<Int>()
    for (i in 0 until s.n * s.n) if (a[i] == 'o' || (a[i] == '*' && wrongMask[i] == '0')) keep.addAll(regionsRuledOut(s.n, s.regions, i))
    for (i in 0 until s.n * s.n) if (m[i] == '1' && a[i] == 'x' && i !in keep) { a[i] = '.'; m[i] = '0' }
    return String(a) to String(m)
}

/** Black stars left when the game ends are cleared (never played). */
private fun clearPending(board: String): String = board.replace('o', '.')

/** Set [cell] to '.' or 'x' by hand, withdrawing any ×s a star there had drawn. */
private fun clearTo(s: RegionsState, cell: Int, ch: Char): RegionsState {
    val wrongMask = setChar(s.wrongMask, cell, '0')
    val (b, m) = withdrawCrosses(s, setChar(s.board, cell, ch), setChar(s.autoMaskOrBlank, cell, '0'), wrongMask)
    return s.copy(history = pushHistory(s), board = b, autoMask = m, wrongMask = wrongMask)
}

private fun isSolved(s: RegionsState): Boolean {
    // Every row's star played; a red star left on the board does not block the win (its mistake
    // is already counted — founder, 2026-09-28: the board never finished with two red stars).
    for (r in 0 until s.n) if (s.board[starOfRow(s, r)] != '*') return false
    return true
}

private fun settle(s: RegionsState, now: Long): RegionsState {
    if (s.status != RegionsStatus.PLAYING) return s
    if (isSolved(s)) return s.copy(board = clearPending(s.board), status = RegionsStatus.WON, endTime = now, history = emptyList())
    if (s.mistakes >= REGIONS_MAX_MISTAKES) return s.copy(board = clearPending(s.board), status = RegionsStatus.LOST, endTime = now, history = emptyList())
    return s
}

private fun placeStar(s: RegionsState, cell: Int, viaHint: Boolean, now: Long): RegionsState {
    val correct = isStarCell(s, cell)
    val wrongMask = setChar(s.wrongMask, cell, if (correct) '0' else '1')
    var board = setChar(s.board, cell, '*')
    var autoMask = setChar(s.autoMaskOrBlank, cell, '0')
    if (correct && s.autoCross) crossOut(board, autoMask, regionsRuledOut(s.n, s.regions, cell)).let { board = it.first; autoMask = it.second }
    // A red star rules nothing out: whatever it drew as a black star goes.
    if (!correct) withdrawCrosses(s, board, autoMask, wrongMask).let { board = it.first; autoMask = it.second }
    return settle(
        s.copy(
            history = pushHistory(s), board = board, autoMask = autoMask,
            hintMask = if (viaHint) setChar(s.hintMask, cell, '1') else s.hintMask,
            wrongMask = wrongMask,
            mistakes = s.mistakes + if (correct) 0 else 1,
            hintsUsed = s.hintsUsed + if (viaHint) 1 else 0,
        ),
        now,
    )
}

/** Pure reducer; [now] stamps endTime on a win/loss. */
fun regionsReduce(s: RegionsState, a: RegionsAction, now: Long = 0): RegionsState {
    when (a) {
        is RegionsAction.SetAutoCross -> return s.copy(autoCross = a.value)
        is RegionsAction.Finish -> return if (s.status == RegionsStatus.PLAYING) s else s.copy(endTime = s.endTime ?: a.now)
        else -> {}
    }
    if (s.status != RegionsStatus.PLAYING) return s
    val total = s.n * s.n
    if (a is RegionsAction.Settle) return settle(s, now)
    return when (a) {
        is RegionsAction.Tap -> {
            if (a.cell !in 0 until total) return s
            val cur = s.board[a.cell]
            if (cur == '*' && s.hintMask[a.cell] == '1') return s
            // Tap = a BLACK star (never judged; auto-crosses), tap a black star = ×, tap an × = clear;
            // a committed star tapped → × (red goes, the mistake stands). A hint star is locked.
            // (founder, 2026-09-28 afternoon)
            when (cur) {
                '.' -> {
                    var board = setChar(s.board, a.cell, 'o'); var autoMask = setChar(s.autoMaskOrBlank, a.cell, '0')
                    if (s.autoCross) crossOut(board, autoMask, regionsRuledOut(s.n, s.regions, a.cell)).let { board = it.first; autoMask = it.second }
                    s.copy(history = pushHistory(s), board = board, autoMask = autoMask)
                }
                'o', '*' -> clearTo(s, a.cell, 'x')
                else -> clearTo(s, a.cell, '.')
            }
        }
        is RegionsAction.Commit -> {
            // Double tap: judge the star — purple stays, red is a mistake and its ×s go.
            if (a.cell !in 0 until total) return s
            val cur = s.board[a.cell]
            if (cur == 'o' || cur == '.') placeStar(s, a.cell, false, now) else s
        }
        is RegionsAction.Erase -> {
            if (a.cell !in 0 until total || s.board[a.cell] == '.') return s
            if (s.board[a.cell] == '*' && s.hintMask[a.cell] == '1') return s
            clearTo(s, a.cell, '.')
        }
        is RegionsAction.Undo -> {
            val prev = s.history.lastOrNull() ?: return s
            val prevAuto = if (prev.autoMask.length == prev.board.length) prev.autoMask else "0".repeat(prev.board.length)
            s.copy(board = prev.board, hintMask = prev.hintMask, wrongMask = prev.wrongMask, autoMask = prevAuto, history = s.history.dropLast(1))
        }
        is RegionsAction.Hint -> {
            var target = -1
            if (a.cell != null && a.cell in 0 until total) { val t = starOfRow(s, a.cell / s.n); if (s.board[t] != '*') target = t }
            if (target < 0) for (r in 0 until s.n) { val t = starOfRow(s, r); if (s.board[t] != '*') { target = t; break } }
            if (target < 0) return s
            placeStar(s, target, true, now)
        }
        else -> s
    }
}

/** Correct stars still to place (for the progress line). */
fun regionsRemaining(s: RegionsState): Int = (0 until s.n).count { s.board[starOfRow(s, it)] != '*' }

// ── Matches row ↔ state ─────────────────────────────────────────────────

data class RegionsReconstruction(val n: Int, val regions: String, val solution: String, val board: String, val hintMask: String, val solved: Boolean)

/** What we store: solutions = [regionsNN, solutionN]; guesses = [boardNN, hintMaskNN]. */
fun regionsMatchRow(s: RegionsState): Pair<List<String>, List<String>> = listOf(s.regions, s.solution) to listOf(s.board, s.hintMask)

/** The solved-board view from a matches row, or null if malformed. */
fun reconstructRegions(solutions: List<String>, guesses: List<String>): RegionsReconstruction? {
    val regions = solutions.getOrNull(0) ?: ""
    val solution = solutions.getOrNull(1) ?: ""
    val n = solution.length
    if (n < 4 || n > 12 || regions.length != n * n || !regions.all { it in '0'..'9' } || !solution.all { it in '0'..'9' }) return null
    val board = guesses.getOrNull(0)?.takeIf { it.length == n * n } ?: ".".repeat(n * n)
    val hintMask = guesses.getOrNull(1)?.takeIf { it.length == n * n } ?: "0".repeat(n * n)
    val solved = (0 until n).all { r -> board[r * n + (solution[r] - '0')] == '*' }
    return RegionsReconstruction(n, regions, solution, board, hintMask, solved)
}
