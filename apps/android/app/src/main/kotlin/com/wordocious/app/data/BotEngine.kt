package com.wordocious.app.data

import com.wordocious.core.GameDictionary
import com.wordocious.core.GameMode
import com.wordocious.core.createInitialState
import com.wordocious.core.evaluateGuess
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
        GameMode.MULTI_DUEL to 2,
    )
    fun boardCount(mode: GameMode): Int = MODE_BOARD_COUNT[mode] ?: 1

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
        val solutions = state.boards.map { it.solution.uppercase() }
        val willSolveAll = if (opts.forceSolve) true else Random.nextDouble() > p.failChance

        val events = ArrayList<Event>()
        val guessLog = ArrayList<VSGuessLogEntry>()
        var cumulativeAttempts = 0
        var boardsSolved = 0
        var lastAtMs = 0.0

        for (bi in 0 until totalBoards) {
            val solution = solutions.getOrElse(bi) { solutions.firstOrNull() ?: "" }
            val steps = opts.targetGuesses ?: Random.nextInt(p.minGuesses, max(p.minGuesses, p.maxGuesses) + 1)
            val boardSolves = willSolveAll || bi < totalBoards - 1
            val path = if (mode == GameMode.PROPERNOUNDLE) fabricatedPath(solution, steps, boardSolves)
            else realWordPath(solution, steps, boardSolves)

            var atMs = lastAtMs
            for ((i, word) in path.withIndex()) {
                atMs += p.perGuessMinMs + Random.nextDouble() * (max(p.perGuessMinMs, p.perGuessMaxMs) - p.perGuessMinMs)
                cumulativeAttempts += 1
                val isSolvingRow = boardSolves && i == path.size - 1
                if (isSolvingRow) boardsSolved += 1
                events.add(Event(max(0.0, atMs - 1100), true, null))
                events.add(Event(atMs, false, VSOpponentProgress(
                    attempts = cumulativeAttempts,
                    solved = boardsSolved >= totalBoards,
                    boardsSolved = boardsSolved,
                    totalBoards = totalBoards,
                    latestGuess = VSOpponentLatestGuess(bi, tiles(solution, word)),
                )))
                guessLog.add(VSGuessLogEntry(bi, word))
            }
            lastAtMs = atMs
        }

        if (opts.targetSolveMs != null && lastAtMs > 0) {
            val scale = opts.targetSolveMs / lastAtMs
            for (idx in events.indices) events[idx] = events[idx].copy(atMs = max(0.0, events[idx].atMs * scale))
            lastAtMs = opts.targetSolveMs
        }

        events.sortBy { it.atMs }
        return Plan(totalBoards, boardsSolved >= totalBoards, boardsSolved, lastAtMs, cumulativeAttempts,
            events, guessLog, solutions)
    }
}
