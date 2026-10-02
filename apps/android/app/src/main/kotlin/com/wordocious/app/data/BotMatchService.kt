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
    /** Opponent dropped mid-match; the server holds a reconnect grace window. */
    var onOpponentDisconnected: ((VSOpponentDisconnected) -> Unit)?
    /** Opponent came back inside the grace window — clear the disconnect UI. */
    var onOpponentReconnected: (() -> Unit)?
    /** OUR reconnect was re-bound to the live match inside the grace window. */
    var onMatchResumed: (() -> Unit)?
    val isConfigured: Boolean
    fun connect(presenceId: String?, token: String?)
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
    /** CPU-only: end the match now using the bot's already-decided plan, instead
     *  of watching its timer run down. No-op for the socket transport. */
    fun resolveNow() {}
}

// ── CPU opponent identity ──

/**
 * How a bot game is set up: one of the engine tiers (a cast bot borrows its tier,
 * FINISH_SPEC D1), Beat your best ("ghost") or the Bot of the Day ("daily", the
 * day host's bot, D2). Which cast bot plays rides alongside as its id
 * (VsLaunch.Bot.castId / CpuOpponent.opponentId).
 */
enum class CpuKind { EASY, MEDIUM, HARD, ADAPTIVE, GHOST, DAILY;
    val key: String get() = name.lowercase()

    /** The cast bot a bare tier falls back to (old callers): easy → Ivy, medium →
     *  Opal, hard → Dewey, adaptive → Umi — the old Rook / Lexi / Nova / Adapt by
     *  difficulty. The Bot of the Day ("daily") and Beat your best ("ghost") never
     *  move the ladder (core ladderAfterGame). */
    val botId: String get() = when (this) {
        EASY -> "ivy"; MEDIUM -> "opal"; HARD -> "dewey"; ADAPTIVE -> "umi"
        GHOST -> com.wordocious.core.BotCast.GHOST_ID; DAILY -> "daily"
    }

    companion object {
        /** The kind (engine tier) that plays a cast bot ("rip" → EASY … "umi" → ADAPTIVE; old ids map). */
        fun forLadder(id: String): CpuKind = when (com.wordocious.core.BotCast.member(id)?.tier) {
            com.wordocious.core.BotCastTier.EASY -> EASY
            com.wordocious.core.BotCastTier.HARD -> HARD
            com.wordocious.core.BotCastTier.ADAPTIVE -> ADAPTIVE
            else -> MEDIUM
        }
    }
}

/** A bot opponent's identity. `artId` is the bot's id (BotArt draws its character;
 *  the ghost keeps its own art); [castId] the cast bot (null for the ghost);
 *  [guesses] its own solve range (null = the tier's / adaptive). */
data class CpuIdentity(
    val name: String,
    val artId: String,
    val color: Long,
    val tier: BotTier,
    val castId: String? = null,
    val guesses: IntRange? = null,
    val adaptive: Boolean = false,
)

object CpuOpponent {
    const val PREFIX = "cpu:"

    /** "cpu:<castId>" for a cast bot, "cpu:ghost" for Beat your best, "cpu:daily:<castId>"
     *  for the Bot of the Day; a bare kind ("cpu:medium") when no bot is named. */
    fun opponentId(kind: CpuKind, castId: String? = null): String = when {
        kind == CpuKind.GHOST -> "${PREFIX}ghost"
        kind == CpuKind.DAILY -> "${PREFIX}daily:${castId ?: com.wordocious.core.BotCast.botOfTheDay(CpuProgressionStore.todayUtc()).id}"
        castId != null -> "$PREFIX$castId"
        else -> "$PREFIX${kind.key}"
    }

    fun isCpu(id: String?): Boolean = id?.startsWith(PREFIX) == true

    private fun forMember(m: com.wordocious.core.BotCastMember): CpuIdentity =
        CpuIdentity(m.name, m.id, m.color, m.botTier, m.id, m.guesses, m.tier == com.wordocious.core.BotCastTier.ADAPTIVE)

    fun identity(oppId: String): CpuIdentity {
        val raw = oppId.removePrefix(PREFIX)
        if (raw == "ghost") return CpuIdentity("Your Ghost", "ghost", 0xFF64748B, BotTier.HARD)
        // The Bot of the Day (D2): the day host's bot ("daily:<id>"; a bare "daily" = today's).
        if (raw == "daily" || raw.startsWith("daily:")) {
            val id = raw.removePrefix("daily").removePrefix(":")
            val m = com.wordocious.core.BotCast.member(id)
                ?: com.wordocious.core.BotCast.botOfTheDay(CpuProgressionStore.todayUtc())
            return forMember(m)
        }
        com.wordocious.core.BotCast.member(raw)?.let { return forMember(it) }
        // A bare tier (old opponent ids): its cast stand-in by difficulty.
        val kind = runCatching { CpuKind.valueOf(raw.uppercase()) }.getOrDefault(CpuKind.MEDIUM)
        return forMember(com.wordocious.core.BotCast.member(kind.botId)!!)
    }
}

data class BotConfig(
    val adaptive: BotEngine.AdaptiveHint? = null,
    /** The cast bot's own solve range (FINISH_SPEC D1), narrowing its tier's. */
    val guessRange: IntRange? = null,
    val ghostGuesses: Int? = null,
    val ghostTimeMs: Double? = null,
    val fixedSeed: String? = null,
    val opponentId: String? = null,
    /** Force the run's outcome: true solves, false fails, null rolls the tier's
     *  odds (a ghost with a target always solves). A challenge ghost passes the
     *  challenger's `run.solved` so an unsolved run is replayed as unsolved. */
    val solve: Boolean? = null,
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
    // The client-side bot never disconnects — these never fire.
    override var onOpponentDisconnected: ((VSOpponentDisconnected) -> Unit)? = null
    override var onOpponentReconnected: (() -> Unit)? = null
    override var onMatchResumed: (() -> Unit)? = null
    override val isConfigured: Boolean get() = true

    private val handler = Handler(Looper.getMainLooper())
    private val pending = ArrayList<Runnable>()
    private var mode: GameMode = GameMode.DUEL
    private var plan: BotEngine.Plan? = null
    private var serverStartAt = 0.0
    private var ended = false
    private val countdownMs = 3000.0
    // The intro clash auto-plays ~2.5s BEFORE the numeric countdown ticks, so hold
    // match_start until intro + countdown elapse (else the countdown flashes).
    private val introMs = 2500.0

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
        forceSolve = config.solve ?: (config.ghostGuesses != null),
        forceFail = config.solve == false,
        adaptive = config.adaptive,
        guessRange = config.guessRange,
    )

    override fun connect(presenceId: String?, token: String?) { handler.post { onConnect?.invoke() } }
    override fun disconnect() { clearTimers() }

    override fun joinQueue(mode: String, dailySeed: String?, inviteCode: String?) {
        this.mode = runCatching { GameMode.valueOf(mode) }.getOrDefault(GameMode.DUEL)
        schedule(900.0) { startMatch(config.fixedSeed ?: generateMatchSeed()) }
    }

    private fun startMatch(seed: String) {
        if (ended) return
        val preMatchMs = introMs + countdownMs   // board appears after intro + countdown
        serverStartAt = System.currentTimeMillis().toDouble() + preMatchMs
        plan = BotEngine.buildPlan(seed, mode, difficulty, planOpts())
        botDone = false; playerDone = false; playerBoardsSolved = 0; playerResult = null
        onMatchFound?.invoke(VSMatchFound(
            matchId = "bot-${serverStartAt.toLong()}", mode = mode.name,
            serverStartAt = serverStartAt, countdownSeconds = countdownMs / 1000, // numeric 3-2-1 (post-intro)
            opponentUserId = config.opponentId ?: CpuOpponent.opponentId(
                runCatching { CpuKind.valueOf(difficulty.name) }.getOrDefault(CpuKind.MEDIUM))))
        schedule(preMatchMs) {
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
    override fun resolveNow() {
        val p = plan ?: return
        if (ended || !playerDone) return
        botDone = true; botTimeMs = p.finishAtMs; maybeEnd()
    }

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
