package com.wordocious.app.data

import android.os.Handler
import android.os.Looper
import com.wordocious.core.GameMode
import com.wordocious.core.generateMatchSeed
import kotlin.math.abs

/**
 * The transport surface VSMatchViewModel depends on. Both the socket
 * (VSMatchService) and the client-side bot (LocalBotMatchService) satisfy it,
 * so the VM can swap between them without changing its lifecycle logic.
 */
interface VSTransport {
    var onConnect: (() -> Unit)?
    var onDisconnect: (() -> Unit)?
    var onQueueStatus: ((VSQueueStatus) -> Unit)?
    var onMatchFound: ((VSMatchFound) -> Unit)?
    var onMatchStart: ((VSMatchStart) -> Unit)?
    var onGuessResult: ((VSGuessResult) -> Unit)?
    var onOpponentProgress: ((VSOpponentProgress) -> Unit)?
    var onMatchEnded: ((VSMatchEnded) -> Unit)?
    var onOpponentStageCompleted: ((VSStageEvent) -> Unit)?
    var onRematchOffered: (() -> Unit)?
    var onRematchDeclined: (() -> Unit)?
    var onRematchStart: ((VSRematchStart) -> Unit)?
    var onOpponentLeft: (() -> Unit)?
    var onServerError: ((VSServerError) -> Unit)?
    var onOpponentTyping: (() -> Unit)?
    val isConfigured: Boolean
    fun connect(presenceId: String?)
    fun disconnect()
    fun joinQueue(mode: String, dailySeed: String?, inviteCode: String?)
    fun leaveQueue()
    fun submitGuess(guess: String, boardIndex: Int = 0)
    fun boardSolved(boardIndex: Int)
    fun playerCompleted(status: String, totalGuesses: Int, timeMs: Int)
    fun stageCompleted(stageIndex: Int)
    fun emitTyping()
    fun abandonMatch()
    fun offerRematch()
    fun declineRematch()
}

// ── CPU opponent identity ──

enum class CpuKind { EASY, MEDIUM, HARD, ADAPTIVE, GHOST, DAILY;
    val key: String get() = name.lowercase()
}

data class CpuIdentity(val name: String, val avatar: String, val color: Long, val tier: BotTier)

object CpuOpponent {
    const val PREFIX = "cpu:"
    fun opponentId(kind: CpuKind): String = "$PREFIX${kind.key}"
    fun isCpu(id: String?): Boolean = id?.startsWith(PREFIX) == true

    fun identity(oppId: String): CpuIdentity {
        return when (val raw = oppId.removePrefix(PREFIX)) {
            "ghost" -> CpuIdentity("Your Ghost", "👻", 0xFF64748B, BotTier.HARD)
            "daily" -> CpuIdentity("Daily Bot", "📅", 0xFFF59E0B, BotTier.MEDIUM)
            "adaptive" -> CpuIdentity("Adapt", "⚖️", 0xFF7C3AED, BotTier.MEDIUM)
            else -> {
                val tier = runCatching { BotTier.valueOf(raw.uppercase()) }.getOrDefault(BotTier.MEDIUM)
                val p = BotPersonas.persona(tier)
                CpuIdentity(p.name, p.avatar, p.color, p.tier)
            }
        }
    }
}

data class BotConfig(
    val adaptive: BotEngine.AdaptiveHint? = null,
    val ghostGuesses: Int? = null,
    val ghostTimeMs: Double? = null,
    val fixedSeed: String? = null,
    val opponentId: String? = null,
)

/**
 * A fully client-side opponent that satisfies VSTransport without a socket. It
 * builds a BotEngine.Plan and replays it on Handler timers, driving the identical
 * onMatchFound / onMatchStart / onOpponentProgress / onMatchEnded callbacks the
 * socket would. Nothing is recorded here — the VM routes CPU results to the
 * separate vs_cpu bucket. Kotlin port of the web LocalBotMatchService.
 */
class LocalBotMatchService(
    private val difficulty: BotDifficulty,
    private val config: BotConfig = BotConfig(),
) : VSTransport {
    override var onConnect: (() -> Unit)? = null
    override var onDisconnect: (() -> Unit)? = null
    override var onQueueStatus: ((VSQueueStatus) -> Unit)? = null
    override var onMatchFound: ((VSMatchFound) -> Unit)? = null
    override var onMatchStart: ((VSMatchStart) -> Unit)? = null
    override var onGuessResult: ((VSGuessResult) -> Unit)? = null
    override var onOpponentProgress: ((VSOpponentProgress) -> Unit)? = null
    override var onMatchEnded: ((VSMatchEnded) -> Unit)? = null
    override var onOpponentStageCompleted: ((VSStageEvent) -> Unit)? = null
    override var onRematchOffered: (() -> Unit)? = null
    override var onRematchDeclined: (() -> Unit)? = null
    override var onRematchStart: ((VSRematchStart) -> Unit)? = null
    override var onOpponentLeft: (() -> Unit)? = null
    override var onServerError: ((VSServerError) -> Unit)? = null
    override var onOpponentTyping: (() -> Unit)? = null
    override val isConfigured: Boolean get() = true

    private val handler = Handler(Looper.getMainLooper())
    private val pending = ArrayList<Runnable>()
    private var mode: GameMode = GameMode.DUEL
    private var plan: BotEngine.Plan? = null
    private var serverStartAt = 0.0
    private var ended = false
    private val countdownMs = 3000.0

    private var botDone = false
    private var botTimeMs = 0.0
    private var playerDone = false
    private var playerBoardsSolved = 0
    private var playerResult: Triple<String, Int, Double>? = null // status, guesses, timeMs

    private fun schedule(ms: Double, work: () -> Unit) {
        val r = Runnable { work() }
        pending.add(r)
        handler.postDelayed(r, ms.toLong().coerceAtLeast(0))
    }
    private fun clearTimers() { pending.forEach { handler.removeCallbacks(it) }; pending.clear() }

    private fun planOpts() = BotEngine.BuildOpts(
        targetGuesses = config.ghostGuesses,
        targetSolveMs = config.ghostTimeMs,
        forceSolve = config.ghostGuesses != null,
        adaptive = config.adaptive,
    )

    override fun connect(presenceId: String?) { handler.post { onConnect?.invoke() } }
    override fun disconnect() { clearTimers() }

    override fun joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {
        this.mode = runCatching { GameMode.valueOf(mode) }.getOrDefault(GameMode.DUEL)
        schedule(900.0) { startMatch(config.fixedSeed ?: generateMatchSeed()) }
    }

    private fun startMatch(seed: String) {
        if (ended) return
        serverStartAt = System.currentTimeMillis().toDouble() + countdownMs
        plan = BotEngine.buildPlan(seed, mode, difficulty, planOpts())
        botDone = false; playerDone = false; playerBoardsSolved = 0; playerResult = null
        onMatchFound?.invoke(VSMatchFound(
            matchId = "bot-${serverStartAt.toLong()}", mode = mode.name,
            serverStartAt = serverStartAt, countdownSeconds = countdownMs / 1000,
            opponentUserId = config.opponentId ?: CpuOpponent.opponentId(
                runCatching { CpuKind.valueOf(difficulty.name) }.getOrDefault(CpuKind.MEDIUM))))
        schedule(countdownMs) {
            if (ended) return@schedule
            onMatchStart?.invoke(VSMatchStart(seed = seed, startTime = serverStartAt))
            runPlan()
        }
    }

    private fun runPlan() {
        val p = plan ?: return
        for (ev in p.events) {
            schedule(ev.atMs) {
                if (ended) return@schedule
                if (ev.typing) onOpponentTyping?.invoke() else ev.progress?.let { onOpponentProgress?.invoke(it) }
            }
        }
        // Gauntlet: advance the opponent's 5-node stepper at each stage clear.
        for ((atMs, stageIndex) in p.stageEvents) {
            schedule(atMs) {
                if (ended) return@schedule
                onOpponentStageCompleted?.invoke(VSStageEvent(stageIndex))
            }
        }
        schedule(p.finishAtMs) {
            if (ended) return@schedule
            botDone = true; botTimeMs = p.finishAtMs; maybeEnd()
        }
    }

    private fun maybeEnd() {
        val p = plan ?: return
        val pr = playerResult ?: return
        if (ended || !botDone || !playerDone) return
        ended = true
        clearTimers()
        val playerWon = pr.first == "won"
        val botWon = p.solved
        val playerBoards = if (playerWon) p.totalBoards else playerBoardsSolved
        val botBoards = p.boardsSolved
        val playerScore = pr.second + pr.third / 1000 / 45
        val botScore = p.totalGuesses + botTimeMs / 1000 / 45
        val winner: String? = when {
            playerWon && !botWon -> "player"
            botWon && !playerWon -> "opponent"
            playerWon && botWon -> when {
                playerBoards > botBoards -> "player"
                botBoards > playerBoards -> "opponent"
                abs(playerScore - botScore) < 0.01 -> "draw"
                else -> if (playerScore < botScore) "player" else "opponent"
            }
            else -> null
        }
        onMatchEnded?.invoke(VSMatchEnded(
            winner = winner, playerGuesses = pr.second, opponentGuesses = p.totalGuesses,
            playerTime = pr.third, opponentTime = botTimeMs, playerScore = playerScore, opponentScore = botScore,
            opponentId = null, recordMatch = false, opponentGuessLog = p.guessLog, solutions = p.solutions, forfeit = false))
    }

    override fun leaveQueue() { clearTimers() }
    override fun submitGuess(guess: String, boardIndex: Int) {}
    override fun boardSolved(boardIndex: Int) { playerBoardsSolved += 1 }
    override fun playerCompleted(status: String, totalGuesses: Int, timeMs: Int) {
        playerResult = Triple(status, totalGuesses, timeMs.toDouble()); playerDone = true; maybeEnd()
    }
    override fun stageCompleted(stageIndex: Int) {}
    override fun emitTyping() {}
    override fun abandonMatch() { ended = true; clearTimers() }
    override fun offerRematch() {
        ended = false; clearTimers()
        val seed = config.fixedSeed ?: generateMatchSeed()
        // Start the bot's clock after the 3s rematch countdown so its guesses land
        // relative to the same start the player sees (parity with the initial match).
        serverStartAt = System.currentTimeMillis().toDouble() + countdownMs
        plan = BotEngine.buildPlan(seed, mode, difficulty, planOpts())
        botDone = false; playerDone = false; playerBoardsSolved = 0; playerResult = null
        onRematchStart?.invoke(VSRematchStart(matchId = "bot-${serverStartAt.toLong()}", seed = seed))
        schedule(countdownMs) { runPlan() }
    }
    override fun declineRematch() {}
}
