package com.wordocious.core

/**
 * Sudoku — deterministic generator, solver and reducer (More Games §4).
 * 1:1 port of packages/core/src/games/sudoku.ts; pinned by sudoku-fixtures.json
 * (SudokuFixtureTest). Everything is integer arithmetic over
 * Mulberry32(simpleHash(seed + "-sudoku-v1")), so the same seed yields the same
 * givens on every platform. Board strings: 81 chars, row-major, '0' = empty.
 */
enum class SudokuDifficulty(val key: String, val clues: Int) {
    EASY("easy", 38), MEDIUM("medium", 32), HARD("hard", 26);
    companion object {
        fun fromKey(k: String?): SudokuDifficulty? = values().firstOrNull { it.key == k }
    }
}

val SUDOKU_DAILY_DIFFICULTY = SudokuDifficulty.MEDIUM
const val SUDOKU_MAX_MISTAKES = 3
private const val MAX_REROLLS = 30
private const val HISTORY_CAP = 200

data class SudokuPuzzle(
    val seed: String,
    val difficulty: SudokuDifficulty,
    val givens: String,
    val solution: String,
    val clues: Int,
    val rerolls: Int,
)

// ── PRNG helpers (rng call ORDER is the parity contract) ─────────────────

private fun randInt(rng: Mulberry32, n: Int): Int = (rng.nextU32() % n).toInt()
private fun <T> shuffle(rng: Mulberry32, arr: List<T>): List<T> {
    val a = arr.toMutableList()
    for (i in a.size - 1 downTo 1) {
        val j = randInt(rng, i + 1)
        val t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

// ── Solved grid ──────────────────────────────────────────────────────────

private fun solvedGrid(rng: Mulberry32): IntArray {
    fun base(r: Int, c: Int) = ((r * 3 + r / 3 + c) % 9) + 1
    val digits = shuffle(rng, listOf(1, 2, 3, 4, 5, 6, 7, 8, 9))
    val bands = shuffle(rng, listOf(0, 1, 2))
    val rowsIn = listOf(shuffle(rng, listOf(0, 1, 2)), shuffle(rng, listOf(0, 1, 2)), shuffle(rng, listOf(0, 1, 2)))
    val stacks = shuffle(rng, listOf(0, 1, 2))
    val colsIn = listOf(shuffle(rng, listOf(0, 1, 2)), shuffle(rng, listOf(0, 1, 2)), shuffle(rng, listOf(0, 1, 2)))
    val transpose = randInt(rng, 2) == 1
    val grid = IntArray(81)
    for (r in 0 until 9) {
        val srcRow = bands[r / 3] * 3 + rowsIn[r / 3][r % 3]
        for (c in 0 until 9) {
            val srcCol = stacks[c / 3] * 3 + colsIn[c / 3][c % 3]
            val v = digits[base(srcRow, srcCol) - 1]
            if (transpose) grid[c * 9 + r] = v else grid[r * 9 + c] = v
        }
    }
    return grid
}

// ── Solver ───────────────────────────────────────────────────────────────

private fun boxOf(i: Int) = ((i / 9) / 3) * 3 + (i % 9) / 3
private const val ALL = 0x1ff

/** Number of solutions, stopping at [limit]. `cells` is 0 for empty. */
fun countSudokuSolutions(cells: IntArray, limit: Int = 2): Int {
    val rows = IntArray(9); val cols = IntArray(9); val boxes = IntArray(9)
    val grid = cells.copyOf()
    for (i in 0 until 81) {
        val v = grid[i]
        if (v == 0) continue
        val bit = 1 shl (v - 1)
        val r = i / 9; val c = i % 9; val b = boxOf(i)
        if ((rows[r] and bit) != 0 || (cols[c] and bit) != 0 || (boxes[b] and bit) != 0) return 0
        rows[r] = rows[r] or bit; cols[c] = cols[c] or bit; boxes[b] = boxes[b] or bit
    }
    var count = 0
    fun search() {
        if (count >= limit) return
        var best = -1; var bestMask = 0; var bestN = 10
        for (i in 0 until 81) {
            if (grid[i] != 0) continue
            val mask = ALL and (rows[i / 9] or cols[i % 9] or boxes[boxOf(i)]).inv()
            val n = Integer.bitCount(mask)
            if (n == 0) return
            if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n == 1) break }
        }
        if (best < 0) { count++; return }
        val r = best / 9; val c = best % 9; val b = boxOf(best)
        for (d in 0 until 9) {
            val bit = 1 shl d
            if ((bestMask and bit) == 0) continue
            grid[best] = d + 1; rows[r] = rows[r] or bit; cols[c] = cols[c] or bit; boxes[b] = boxes[b] or bit
            search()
            grid[best] = 0; rows[r] = rows[r] and bit.inv(); cols[c] = cols[c] and bit.inv(); boxes[b] = boxes[b] and bit.inv()
            if (count >= limit) return
        }
    }
    search()
    return count
}

/** True when naked + hidden singles alone solve the puzzle (the Easy gate; Hard must fail it). */
fun sudokuSolvableBySingles(cells: IntArray): Boolean {
    val grid = cells.copyOf()
    fun candidates(i: Int): Int {
        if (grid[i] != 0) return 0
        var used = 0
        val r = i / 9; val c = i % 9; val b = boxOf(i)
        for (k in 0 until 9) {
            val rv = grid[r * 9 + k]; if (rv != 0) used = used or (1 shl (rv - 1))
            val cv = grid[k * 9 + c]; if (cv != 0) used = used or (1 shl (cv - 1))
            val bi = ((b / 3) * 3 + k / 3) * 9 + (b % 3) * 3 + (k % 3)
            val bv = grid[bi]; if (bv != 0) used = used or (1 shl (bv - 1))
        }
        return ALL and used.inv()
    }
    fun unitCell(kind: Int, u: Int, k: Int): Int = when (kind) {
        0 -> u * 9 + k
        1 -> k * 9 + u
        else -> ((u / 3) * 3 + k / 3) * 9 + (u % 3) * 3 + (k % 3)
    }
    var progress = true
    while (progress) {
        progress = false
        for (i in 0 until 81) {
            if (grid[i] != 0) continue
            val m = candidates(i)
            if (m == 0) return false
            if ((m and (m - 1)) == 0) { grid[i] = Integer.numberOfTrailingZeros(m) + 1; progress = true }
        }
        for (kind in 0 until 3) for (u in 0 until 9) for (d in 0 until 9) {
            val bit = 1 shl d
            var whereAt = -1; var n = 0; var placed = false
            for (k in 0 until 9) {
                val i = unitCell(kind, u, k)
                if (grid[i] == d + 1) { placed = true; break }
                if (grid[i] == 0 && (candidates(i) and bit) != 0) { whereAt = i; n++ }
            }
            if (!placed && n == 1) { grid[whereAt] = d + 1; progress = true }
        }
    }
    return grid.all { it != 0 }
}

// ── Generator ────────────────────────────────────────────────────────────

private fun toStr(cells: IntArray): String = cells.joinToString("")
fun sudokuCells(s: String): IntArray = IntArray(s.length) { s[it] - '0' }

private fun attempt(seed: String, difficulty: SudokuDifficulty, k: Int): Pair<IntArray, IntArray> {
    val attemptSeed = if (k == 0) seed else "$seed-r$k"
    val rng = Mulberry32(simpleHash("$attemptSeed-sudoku-v1"))
    val solution = solvedGrid(rng)
    val target = difficulty.clues
    val order = shuffle(rng, (0 until 81).toList())
    val givens = solution.copyOf()
    var clues = 81
    for (i in order) {
        if (clues <= target) break
        val save = givens[i]
        givens[i] = 0
        if (countSudokuSolutions(givens, 2) == 1) clues-- else givens[i] = save
    }
    return givens to solution
}

private fun passesGate(givens: IntArray, difficulty: SudokuDifficulty): Boolean {
    if (difficulty == SudokuDifficulty.MEDIUM) return true
    val singles = sudokuSolvableBySingles(givens)
    return if (difficulty == SudokuDifficulty.EASY) singles else !singles
}

/** The puzzle for a seed (daily → Medium; `unlimited-SUDOKU-<ts>-<difficulty>` → chosen). */
fun generateSudoku(seed: String, difficulty: SudokuDifficulty = SUDOKU_DAILY_DIFFICULTY): SudokuPuzzle {
    var last = attempt(seed, difficulty, 0)
    var k = 0
    while (!passesGate(last.first, difficulty) && k < MAX_REROLLS) {
        k++
        last = attempt(seed, difficulty, k)
    }
    return SudokuPuzzle(seed, difficulty, toStr(last.first), toStr(last.second), last.first.count { it != 0 }, k)
}

/** Difficulty encoded in an Unlimited seed's trailing segment; the daily is Medium. */
fun sudokuDifficultyForSeed(seed: String): SudokuDifficulty =
    SudokuDifficulty.fromKey(seed.split("-").lastOrNull()) ?: SUDOKU_DAILY_DIFFICULTY

/** The first daily Sudoku's local date — "#1". Purely cosmetic numbering. */
const val SUDOKU_DAILY_EPOCH = "2026-09-23"
/** "#N" for the daily on [day] (YYYY-MM-DD local); 1 on the epoch day, never below 1. */
fun sudokuDailyNumber(day: String): Int {
    val idx = Bank.dayIndex(day, SUDOKU_DAILY_EPOCH) ?: return 1
    return maxOf(1, idx + 1)
}

// ── Reducer ──────────────────────────────────────────────────────────────

enum class SudokuStatus(val key: String) { PLAYING("playing"), WON("won"), LOST("lost") }

data class SudokuSnapshot(val board: String, val notes: List<Int>, val hintMask: String, val wrongMask: String)

data class SudokuState(
    val seed: String,
    val difficulty: SudokuDifficulty,
    val givens: String,
    val solution: String,
    val board: String,
    val notes: List<Int>,
    val hintMask: String,
    val wrongMask: String,
    val mistakes: Int,
    val hintsUsed: Int,
    val notesMode: Boolean,
    val autoClearNotes: Boolean,
    val status: SudokuStatus,
    val history: List<SudokuSnapshot>,
    val startTime: Long,
    val endTime: Long?,
) {
    val snapshot: SudokuSnapshot get() = SudokuSnapshot(board, notes, hintMask, wrongMask)

    companion object {
        fun create(puzzle: SudokuPuzzle, startTime: Long): SudokuState = SudokuState(
            seed = puzzle.seed, difficulty = puzzle.difficulty, givens = puzzle.givens, solution = puzzle.solution,
            board = puzzle.givens, notes = List(81) { 0 }, hintMask = "0".repeat(81), wrongMask = "0".repeat(81),
            mistakes = 0, hintsUsed = 0, notesMode = false, autoClearNotes = true,
            status = SudokuStatus.PLAYING, history = emptyList(), startTime = startTime, endTime = null,
        )
    }
}

sealed class SudokuAction {
    data class Place(val cell: Int, val digit: Int) : SudokuAction()
    data class Erase(val cell: Int) : SudokuAction()
    object Undo : SudokuAction()
    data class Hint(val cell: Int? = null) : SudokuAction()
    object ToggleNotes : SudokuAction()
    data class NoteToggle(val cell: Int, val digit: Int) : SudokuAction()
    data class SetAutoClear(val value: Boolean) : SudokuAction()
    data class Finish(val now: Long) : SudokuAction()
}

private fun setChar(s: String, i: Int, ch: Char): String = s.substring(0, i) + ch + s.substring(i + 1)
private fun peers(i: Int): List<Int> {
    val r = i / 9; val c = i % 9; val b = boxOf(i)
    val out = HashSet<Int>()
    for (k in 0 until 9) {
        out.add(r * 9 + k); out.add(k * 9 + c)
        out.add(((b / 3) * 3 + k / 3) * 9 + (b % 3) * 3 + (k % 3))
    }
    out.remove(i)
    return out.sorted()
}
private fun pushHistory(s: SudokuState): List<SudokuSnapshot> {
    val h = s.history + s.snapshot
    return if (h.size > HISTORY_CAP) h.takeLast(HISTORY_CAP) else h
}
private fun clearPeerNotes(notes: List<Int>, cell: Int, digit: Int): List<Int> {
    val bit = 1 shl (digit - 1)
    val out = notes.toMutableList()
    for (p in peers(cell)) out[p] = out[p] and bit.inv()
    return out
}
private fun settle(s: SudokuState, now: Long): SudokuState {
    if (s.status != SudokuStatus.PLAYING) return s
    if (s.board == s.solution) return s.copy(status = SudokuStatus.WON, endTime = now, history = emptyList())
    if (s.mistakes >= SUDOKU_MAX_MISTAKES) return s.copy(status = SudokuStatus.LOST, endTime = now, history = emptyList())
    return s
}

/** Pure reducer; [now] stamps endTime on a win/loss. */
fun sudokuReduce(s: SudokuState, a: SudokuAction, now: Long = 0): SudokuState {
    when (a) {
        is SudokuAction.SetAutoClear -> return s.copy(autoClearNotes = a.value)
        is SudokuAction.ToggleNotes -> return s.copy(notesMode = !s.notesMode)
        is SudokuAction.Finish -> return if (s.status == SudokuStatus.PLAYING) s else s.copy(endTime = s.endTime ?: a.now)
        else -> {}
    }
    if (s.status != SudokuStatus.PLAYING) return s

    return when (a) {
        is SudokuAction.Place -> {
            if (a.cell !in 0..80 || a.digit !in 1..9) return s
            if (s.givens[a.cell] != '0') return s
            if (s.notesMode) return sudokuReduce(s, SudokuAction.NoteToggle(a.cell, a.digit), now)
            if (s.board[a.cell] == ('0' + a.digit)) return s
            val correct = s.solution[a.cell] == ('0' + a.digit)
            var notes = s.notes.toMutableList().also { it[a.cell] = 0 }.toList()
            if (correct && s.autoClearNotes) notes = clearPeerNotes(notes, a.cell, a.digit)
            settle(
                s.copy(
                    history = pushHistory(s),
                    board = setChar(s.board, a.cell, '0' + a.digit),
                    notes = notes,
                    wrongMask = setChar(s.wrongMask, a.cell, if (correct) '0' else '1'),
                    mistakes = s.mistakes + if (correct) 0 else 1,
                ),
                now,
            )
        }
        is SudokuAction.Erase -> {
            if (a.cell !in 0..80 || s.givens[a.cell] != '0') return s
            if (s.board[a.cell] == '0' && s.notes[a.cell] == 0) return s
            s.copy(
                history = pushHistory(s),
                board = setChar(s.board, a.cell, '0'),
                notes = s.notes.toMutableList().also { it[a.cell] = 0 },
                wrongMask = setChar(s.wrongMask, a.cell, '0'),
            )
        }
        is SudokuAction.Undo -> {
            val prev = s.history.lastOrNull() ?: return s
            s.copy(board = prev.board, notes = prev.notes, hintMask = prev.hintMask, wrongMask = prev.wrongMask, history = s.history.dropLast(1))
        }
        is SudokuAction.Hint -> {
            fun eligible(i: Int) = s.givens[i] == '0' && s.board[i] != s.solution[i]
            var target = if (a.cell != null && a.cell in 0..80 && eligible(a.cell)) a.cell else -1
            if (target < 0) for (i in 0 until 81) if (eligible(i)) { target = i; break }
            if (target < 0) return s
            val digit = s.solution[target] - '0'
            var notes = s.notes.toMutableList().also { it[target] = 0 }.toList()
            if (s.autoClearNotes) notes = clearPeerNotes(notes, target, digit)
            settle(
                s.copy(
                    history = pushHistory(s),
                    board = setChar(s.board, target, '0' + digit),
                    notes = notes,
                    hintMask = setChar(s.hintMask, target, '1'),
                    wrongMask = setChar(s.wrongMask, target, '0'),
                    hintsUsed = s.hintsUsed + 1,
                ),
                now,
            )
        }
        is SudokuAction.NoteToggle -> {
            if (a.cell !in 0..80 || a.digit !in 1..9) return s
            if (s.givens[a.cell] != '0' || s.board[a.cell] != '0') return s
            s.copy(history = pushHistory(s), notes = s.notes.toMutableList().also { it[a.cell] = it[a.cell] xor (1 shl (a.digit - 1)) })
        }
        else -> s
    }
}

/** Cells left to fill (for the progress line). */
fun sudokuRemaining(s: SudokuState): Int = (0 until 81).count { s.board[it] != s.solution[it] }

// ── Matches row ↔ state ─────────────────────────────────────────────────

data class SudokuReconstruction(val solution: String, val givens: String, val board: String, val hintMask: String, val solved: Boolean)

/** What we store: solutions = [solution81, givens81]; guesses = [board81, hintMask81]. */
fun sudokuMatchRow(s: SudokuState): Pair<List<String>, List<String>> = listOf(s.solution, s.givens) to listOf(s.board, s.hintMask)

/** The solved-puzzle view from a matches row, or null if malformed. */
fun reconstructSudoku(solutions: List<String>, guesses: List<String>): SudokuReconstruction? {
    val solution = solutions.getOrNull(0) ?: ""
    val givens = solutions.getOrNull(1) ?: ""
    val board = guesses.getOrNull(0)?.takeIf { it.length == 81 } ?: givens
    val hintMask = guesses.getOrNull(1)?.takeIf { it.length == 81 } ?: "0".repeat(81)
    if (solution.length != 81 || !solution.all { it in '1'..'9' }) return null
    if (givens.length != 81 || !givens.all { it in '0'..'9' }) return null
    return SudokuReconstruction(solution, givens, board, hintMask, board == solution)
}
