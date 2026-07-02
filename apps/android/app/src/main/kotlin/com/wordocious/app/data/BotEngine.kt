package com.wordocious.app.data

import com.wordocious.core.GameDictionary
import com.wordocious.core.GameMode
import com.wordocious.core.createInitialState
import com.wordocious.core.evaluateGuess
import com.wordocious.core.gauntletStages
import com.wordocious.core.gauntletTotalSolutions
import com.wordocious.core.generateSolutionsFromSeed
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * Turns (seed, mode, difficulty) into a believable opponent trajectory — a
 * schedule of VSOpponentProgress events + a revealed guess log, ending in a
 * solve or a fail. Kotlin port of apps/web/lib/bot/bot-engine.ts. Runs entirely
 * on-device; LocalBotMatchService replays the plan on timers.
 */
object BotEngine {

    private val MODE_BOARD_COUNT = mapOf(
        GameMode.DUEL to 1, GameMode.DUEL_6 to 1, GameMode.DUEL_7 to 1, GameMode.PROPERNOUNDLE to 1,
        GameMode.QUORDLE to 4, GameMode.SEQUENCE to 4, GameMode.RESCUE to 4, GameMode.OCTORDLE to 8,
        GameMode.MULTI_DUEL to 2, GameMode.GAUNTLET to gauntletTotalSolutions,
    )
    fun boardCount(mode: GameMode): Int = MODE_BOARD_COUNT[mode] ?: 1

    /** Real per-mode guess cap (mirrors core createInitialState). */
    private val MODE_MAX_GUESSES = mapOf(
        GameMode.DUEL to 6, GameMode.DUEL_6 to 7, GameMode.DUEL_7 to 8, GameMode.PROPERNOUNDLE to 6,
        GameMode.QUORDLE to 9, GameMode.OCTORDLE to 13, GameMode.SEQUENCE to 10, GameMode.RESCUE to 6,
        GameMode.MULTI_DUEL to 6,
    )
    private fun maxGuessesFor(mode: GameMode): Int = MODE_MAX_GUESSES[mode] ?: 6

    data class AdaptiveHint(val winRate: Double = 0.5, val avgGuesses: Int? = null)

    data class BuildOpts(
        val targetGuesses: Int? = null,
        val targetSolveMs: Double? = null,
        val forceSolve: Boolean = false,
        val adaptive: AdaptiveHint? = null,
    )

    data class Event(val atMs: Double, val typing: Boolean, val progress: VSOpponentProgress?)

    data class Plan(
        val totalBoards: Int,
        val solved: Boolean,
        val boardsSolved: Int,
        val finishAtMs: Double,
        val totalGuesses: Int,
        val events: List<Event>,
        /** Gauntlet: (atMs, stageIndex) when the opponent clears each stage. */
        val stageEvents: List<Pair<Double, Int>>,
        val guessLog: List<VSGuessLogEntry>,
        val solutions: List<String>,
    )

    private data class DiffParams(
        val perGuessMinMs: Double, val perGuessMaxMs: Double,
        val minGuesses: Int, val maxGuesses: Int, val failChance: Double,
    )

    private fun params(tier: BotTier) = when (tier) {
        BotTier.EASY -> DiffParams(12000.0, 20000.0, 5, 6, 0.30)
        BotTier.MEDIUM -> DiffParams(7000.0, 12000.0, 4, 5, 0.10)
        BotTier.HARD -> DiffParams(3000.0, 6000.0, 2, 4, 0.02)
    }

    private fun resolveParams(difficulty: BotDifficulty, hint: AdaptiveHint?): DiffParams {
        if (difficulty != BotDifficulty.ADAPTIVE) {
            val tier = runCatching { BotTier.valueOf(difficulty.name) }.getOrDefault(BotTier.MEDIUM)
            return params(tier)
        }
        val wr = hint?.winRate ?: 0.5
        val target = hint?.avgGuesses ?: 4
        val minG = max(2, target - 1)
        val maxG = max(minG + 1, target + 1)
        val speed = 1 - min(1.0, max(0.0, wr))
        val perMin = 4000 + speed * 8000
        return DiffParams(perMin, perMin + 5000, minG, maxG, 0.05 + speed * 0.2)
    }

    private fun greens(word: String, solution: String): Int {
        var n = 0
        for (i in 0 until min(word.length, solution.length)) if (word[i] == solution[i]) n++
        return n
    }

    private fun realWordPath(solution: String, steps: Int, willSolve: Boolean): List<String> {
        val len = solution.length
        val pool = GameDictionary.getAllowedWords().filter { it.length == len && it != solution }
        if (pool.isEmpty()) return fabricatedPath(solution, steps, willSolve)
        val path = ArrayList<String>()
        val used = HashSet<String>()
        val solvingIndex = if (willSolve) steps - 1 else -1
        for (i in 0 until steps) {
            if (i == solvingIndex) { path.add(solution); break }
            val frac = if (steps > 1) i.toDouble() / (steps - 1) else 0.0
            val targetGreens = min(len - 1, (frac * (len - 1)).roundToInt())
            var best: String? = null
            var bestDelta = Int.MAX_VALUE
            repeat(60) {
                val cand = pool[Random.nextInt(pool.size)]
                if (cand !in used) {
                    val delta = abs(greens(cand, solution) - targetGreens)
                    if (delta < bestDelta) { bestDelta = delta; best = cand }
                }
            }
            val word = best ?: pool.random()
            used.add(word)
            path.add(word)
        }
        return path
    }

    private fun fabricatedPath(solution: String, steps: Int, willSolve: Boolean): List<String> {
        val bare = solution.replace(" ", "")
        val len = bare.length
        val letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        val path = ArrayList<String>()
        val solvingIndex = if (willSolve) steps - 1 else -1
        for (i in 0 until steps) {
            if (i == solvingIndex) { path.add(bare); break }
            val frac = if (steps > 1) i.toDouble() / (steps - 1) else 0.0
            val keep = min(len - 1, (frac * (len - 1)).roundToInt())
            val sb = StringBuilder()
            for (p in 0 until len) sb.append(if (p < keep) bare[p] else letters[Random.nextInt(26)])
            path.add(sb.toString())
        }
        return path
    }

    private fun tiles(solution: String, guess: String): List<String> =
        evaluateGuess(solution, guess).tiles.map { it.state.name }

    fun buildPlan(seed: String, mode: GameMode, difficulty: BotDifficulty, opts: BuildOpts = BuildOpts()): Plan {
        val state = createInitialState(seed, mode)
        val totalBoards = boardCount(mode)
        val p = resolveParams(difficulty, opts.adaptive)
        // Gauntlet's createInitialState boards hold only the current stage; the
        // full 21-board run comes from the seed directly (reducer parity).
        val solutions = when (mode) {
            GameMode.GAUNTLET ->
                generateSolutionsFromSeed(seed, gauntletTotalSolutions).map { it.uppercase() }
            GameMode.PROPERNOUNDLE -> {
                // ProperNoundle's answer comes from its OWN puzzle set — pull the
                // actual (normalized) PN answer for the seed so the bot plays the
                // same proper noun as the player and the result screen reveals
                // the right solution (iOS build-89 parity; the reducer's raw
                // answer isn't normalized, so accents/spaces would never match
                // the player's normalized winning guess).
                val pn = com.wordocious.core.ProperNoundle.puzzleForSeed(seed)
                listOf(
                    pn?.let { com.wordocious.core.ProperNoundle.normalize(it.answer).uppercase() }
                        ?: (state.boards.firstOrNull()?.solution?.uppercase() ?: ""),
                )
            }
            else -> state.boards.map { it.solution.uppercase() }
        }
        val willSolveAll = if (opts.forceSolve) true else Random.nextDouble() > p.failChance

        // The bot must play by the REAL rules: shared-guess modes (Quad/Octo/
        // Deliverance, and multi-board Gauntlet stages) get ONE submission
        // sequence capped at the mode's max — each submission applies to every
        // unsolved board. The old per-board-independent model reported
        // impossible guess counts (43 in a 13-max OctoWord), which skewed
        // scores and produced garbage when the log was replayed on the recap.
        val events = ArrayList<Event>()
        val stageEvents = ArrayList<Pair<Double, Int>>()
        val guessLog = ArrayList<VSGuessLogEntry>()
        var cumulativeAttempts = 0
        var boardsSolved = 0
        var lastAtMs = 0.0

        fun emit(word: String, entries: List<VSOpponentLatestGuess>, logBoard: Int, single: VSOpponentLatestGuess? = null) {
            lastAtMs += p.perGuessMinMs + Random.nextDouble() * (max(p.perGuessMinMs, p.perGuessMaxMs) - p.perGuessMinMs)
            cumulativeAttempts += 1
            events.add(Event(max(0.0, lastAtMs - 1100), true, null))
            events.add(Event(lastAtMs, false, VSOpponentProgress(
                attempts = cumulativeAttempts,
                solved = boardsSolved >= totalBoards,
                boardsSolved = boardsSolved,
                totalBoards = totalBoards,
                latestGuess = single,
                latestGuesses = if (single == null) entries else null,
            )))
            guessLog.add(VSGuessLogEntry(logBoard, word))
        }

        /** Shared-guess group (applyToAll): info-gathering fillers, then the
         *  solutions one per submission. `budget` = the real max guesses. */
        fun sharedSegment(offset: Int, sols: List<String>, budget: Int, solveAll: Boolean, stageIndex: Int? = null) {
            val n = sols.size
            val solveCount = if (solveAll) n else max(0, n - 1)
            val fillerCount: Int = when {
                opts.targetGuesses != null -> max(0, min(budget, opts.targetGuesses) - solveCount)
                !solveAll -> max(0, budget - solveCount) // failed run burns the budget
                else -> max(0, min(
                    budget - solveCount,
                    Random.nextInt(max(0, p.minGuesses - 2), max(1, p.maxGuesses - 2) + 1),
                ))
            }
            // Fillers must not accidentally solve a board they weren't credited for.
            val fillers = if (fillerCount > 0)
                realWordPath(sols[n - 1], fillerCount, false).filter { it !in sols }
            else emptyList()
            val solvedLocal = HashSet<Int>()
            val solveOrder = (0 until n).shuffled().take(solveCount)
            val sequence: List<Pair<String, Int?>> =
                fillers.map { it to null as Int? } + solveOrder.map { sols[it] to it as Int? }
            for ((word, solves) in sequence) {
                if (solves != null) { solvedLocal.add(solves); boardsSolved += 1 }
                val entries = ArrayList<VSOpponentLatestGuess>()
                for (li in 0 until n) {
                    if (li !in solvedLocal || solves == li) {
                        entries.add(VSOpponentLatestGuess(offset + li, tiles(sols[li], word)))
                    }
                }
                emit(word, entries, offset + (solves ?: 0))
            }
            if (stageIndex != null && solveAll) stageEvents.add(lastAtMs to stageIndex)
        }

        /** Sequential group (Succession / sequential Gauntlet stages): boards in
         *  order, one at a time, sharing one guess budget. */
        fun sequentialSegment(offset: Int, sols: List<String>, budget: Int, solveAll: Boolean, stageIndex: Int? = null) {
            var remaining = budget
            for ((li, sol) in sols.withIndex()) {
                if (remaining <= 0) return
                val isLast = li == sols.size - 1
                val fails = !solveAll && isLast
                val reserve = sols.size - 1 - li // ≥1 guess for each later board
                val steps = if (fails) remaining
                else max(1, min(remaining - reserve, Random.nextInt(1, max(1, min(3, p.maxGuesses - 2)) + 1)))
                val path = realWordPath(sol, steps, !fails)
                for ((i, word) in path.withIndex()) {
                    val solving = !fails && i == path.size - 1
                    if (solving) boardsSolved += 1
                    emit(word, emptyList(), offset + li, VSOpponentLatestGuess(offset + li, tiles(sol, word)))
                }
                remaining -= path.size
                if (fails) return
            }
            if (stageIndex != null && solveAll) stageEvents.add(lastAtMs to stageIndex)
        }

        when (mode) {
            GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.RESCUE, GameMode.MULTI_DUEL ->
                sharedSegment(0, solutions, maxGuessesFor(mode), willSolveAll)
            GameMode.SEQUENCE ->
                sequentialSegment(0, solutions, maxGuessesFor(mode), willSolveAll)
            GameMode.GAUNTLET -> {
                var offset = 0
                for ((si, stage) in gauntletStages.withIndex()) {
                    val sols = solutions.subList(offset, min(solutions.size, offset + stage.boardCount)).toList()
                    if (sols.isEmpty()) break
                    val lastStage = si == gauntletStages.size - 1
                    val stageSolves = willSolveAll || !lastStage
                    if (stage.boardCount == 1 || stage.sequential) {
                        sequentialSegment(offset, sols, stage.maxGuesses, stageSolves, si)
                    } else {
                        sharedSegment(offset, sols, stage.maxGuesses, stageSolves, si)
                    }
                    offset += stage.boardCount
                    if (!stageSolves) break // a failed stage ends the run
                }
            }
            else -> {
                // Single-board modes (Classic/Six/Seven/ProperNoundle).
                val solution = solutions.firstOrNull() ?: ""
                val cap = maxGuessesFor(mode)
                val steps = min(cap, opts.targetGuesses
                    ?: Random.nextInt(p.minGuesses, max(p.minGuesses, p.maxGuesses) + 1))
                val path = if (mode == GameMode.PROPERNOUNDLE)
                    fabricatedPath(solution, if (willSolveAll) steps else cap, willSolveAll)
                else realWordPath(solution, if (willSolveAll) steps else cap, willSolveAll)
                for ((i, word) in path.withIndex()) {
                    if (willSolveAll && i == path.size - 1) boardsSolved += 1
                    emit(word, emptyList(), 0, VSOpponentLatestGuess(0, tiles(solution, word)))
                }
            }
        }

        var stageEventsOut: List<Pair<Double, Int>> = stageEvents
        if (opts.targetSolveMs != null && lastAtMs > 0) {
            val scale = opts.targetSolveMs / lastAtMs
            for (idx in events.indices) events[idx] = events[idx].copy(atMs = max(0.0, events[idx].atMs * scale))
            stageEventsOut = stageEvents.map { (at, si) -> max(0.0, at * scale) to si }
            lastAtMs = opts.targetSolveMs
        }

        events.sortBy { it.atMs }
        return Plan(totalBoards, boardsSolved >= totalBoards, boardsSolved, lastAtMs, cumulativeAttempts,
            events, stageEventsOut, guessLog, solutions)
    }
}
