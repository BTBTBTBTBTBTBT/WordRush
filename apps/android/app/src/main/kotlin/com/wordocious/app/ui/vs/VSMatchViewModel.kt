package com.wordocious.app.ui.vs

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.GameViewModel
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.GameResultsService
import com.wordocious.app.data.VSMatchEnded
import com.wordocious.app.data.VSMatchFound
import com.wordocious.app.data.VSMatchService
import com.wordocious.app.data.VSOpponentProgress
import com.wordocious.app.data.VSPlayLimit
import com.wordocious.app.data.tileStates
import com.wordocious.app.todayLocalDate
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.generateDailySeed
import com.wordocious.core.generateSolutionsFromSeed
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Drives a live VS match — the Android port of iOS VSMatchViewModel / web
 * vs-game.tsx state machine. Owns the socket service + a child GameViewModel
 * (the player's board, engine-driven from the match seed), relays the player's
 * guesses/solves/completion, and renders opponent progress from server events.
 *
 * This increment supports the board modes (DUEL, DUEL_6/7, QUORDLE, OCTORDLE,
 * SEQUENCE, RESCUE). ProperNoundle VS + private invites + AchievementService
 * writes are deferred (no ProperNoundleVM / InviteService / checkAchievements on
 * Android yet) — see the VS bible note.
 */
enum class VSScreen { QUEUE, MATCH, WAITING, RESULT, OPPONENT_LEFT, ALREADY_PLAYED_DAILY, NOT_CONFIGURED }
enum class RematchState { IDLE, OFFERED, RECEIVED, DECLINED }

class OpponentProgressState {
    var attempts by mutableStateOf(0)
    var solved by mutableStateOf(false)
    var boardsSolved by mutableStateOf(0)
    var totalBoards by mutableStateOf(0)
    var stagesCleared by mutableStateOf(0)
    var tiles by mutableStateOf<Map<Int, List<List<TileState>>>>(emptyMap())
}

class VSMatchViewModel(
    val mode: GameMode,
    val isDaily: Boolean = false,
    val inviteCode: String? = null,
) : ViewModel() {

    var screen by mutableStateOf(VSScreen.QUEUE)
    var queuePosition by mutableStateOf(0)
    var countdown by mutableStateOf<Int?>(null)     // non-null → "Match Found" overlay
    var game by mutableStateOf<GameViewModel?>(null)
    val opponent = OpponentProgressState()
    var result by mutableStateOf<VSMatchEnded?>(null)
    var playerTimeMs by mutableStateOf(0)
    var rematch by mutableStateOf(RematchState.IDLE)
    var message by mutableStateOf<String?>(null)
    var dailyAnswer by mutableStateOf("")
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)

    private val service = VSMatchService()
    private var seed = ""
    private var matchStartMs = 0.0
    private var resultRecorded = false
    private var countdownJob: Job? = null
    private var started = false

    val isPro: Boolean get() = AuthService.isProActive
    /** Live elapsed seconds for the in-match header clock (web vs-classic parity). */
    val matchElapsedSeconds: Int get() =
        if (matchStartMs > 0) (((System.currentTimeMillis() - matchStartMs) / 1000).toInt()).coerceAtLeast(0) else 0
    private val dailyVsActive: Boolean get() = isDaily && !isPro && mode == GameMode.DUEL

    // ── Lifecycle ─────────────────────────────────────────────────────────────────
    fun start() {
        if (started) return
        started = true
        if (!service.isConfigured) { screen = VSScreen.NOT_CONFIGURED; return }

        val dailySeed: String? = if (dailyVsActive) generateDailySeed(todayLocalDate(), "DUEL_VS") else null
        if (dailyVsActive && VSPlayLimit.hasPlayedToday()) {
            dailyAnswer = dailySeed?.let { generateSolutionsFromSeed(it, 1).firstOrNull() } ?: ""
            screen = VSScreen.ALREADY_PLAYED_DAILY
            return
        }

        wireHandlers()
        service.connect(presenceId = AuthService.userId?.let { "u:$it" })
        service.joinQueue(mode = mode.name, dailySeed = dailySeed, inviteCode = inviteCode)
    }

    fun leave() {
        countdownJob?.cancel()
        service.leaveQueue()
        service.disconnect()
        game?.stopTimer()
    }

    fun forfeit() {
        service.abandonMatch()
        service.disconnect()
        game?.stopTimer()
    }

    override fun onCleared() {
        countdownJob?.cancel()
        service.disconnect()
        game?.stopTimer()
    }

    // ── User actions ────────────────────────────────────────────────────────────
    fun offerRematch() {
        if (!isPro) { message = "Rematches are a Pro feature."; return }
        rematch = RematchState.OFFERED
        service.offerRematch()
    }
    /** Accept == re-emit offer_rematch (server starts once both have offered). */
    fun acceptRematch() = offerRematch()
    fun declineRematch() { rematch = RematchState.DECLINED; service.declineRematch() }

    // ── Socket handlers ───────────────────────────────────────────────────────────
    private fun wireHandlers() {
        service.onQueueStatus = { queuePosition = it.position }
        service.onMatchFound = { handleMatchFound(it) }
        service.onMatchStart = { beginMatch(it.seed, it.startTime) }
        service.onOpponentProgress = { applyOpponentProgress(it) }
        service.onOpponentStageCompleted = { opponent.stagesCleared = max(opponent.stagesCleared, it.stageIndex + 1) }
        service.onMatchEnded = { handleMatchEnded(it) }
        service.onRematchOffered = { rematch = RematchState.RECEIVED }
        service.onRematchDeclined = { rematch = RematchState.DECLINED }
        service.onRematchStart = { beginMatch(it.seed, null) }
        service.onOpponentLeft = { message = "Opponent left the match"; screen = VSScreen.OPPONENT_LEFT }
        service.onServerError = { message = it.message }
    }

    private fun handleMatchFound(data: VSMatchFound) {
        val secs = max(1, data.countdownSeconds.toInt())
        countdown = secs
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            var c = secs
            while (c > 1) { delay(1000); c -= 1; countdown = c }
            delay(1000); countdown = null
        }
    }

    private fun beginMatch(newSeed: String, startMs: Double?) {
        seed = newSeed
        matchStartMs = startMs ?: (System.currentTimeMillis().toDouble())
        opponent.attempts = 0; opponent.solved = false
        opponent.boardsSolved = 0; opponent.totalBoards = 0
        opponent.stagesCleared = 0; opponent.tiles = emptyMap()
        result = null
        rematch = RematchState.IDLE
        resultRecorded = false
        countdown = null

        game?.stopTimer()
        val vm = GameViewModel(seed = newSeed, mode = mode, isVersus = true)
        vm.onGuessCommitted = { guess -> service.submitGuess(guess, 0) }
        vm.onBoardSolved = { idx -> service.boardSolved(idx) }
        vm.onCompleted = { status, guesses ->
            val timeMs = max(0, (System.currentTimeMillis() - matchStartMs).toInt())
            playerTimeMs = timeMs
            service.playerCompleted(if (status == GameStatus.WON) "won" else "lost", guesses, timeMs)
            screen = VSScreen.WAITING
        }
        game = vm
        screen = VSScreen.MATCH
    }

    private fun applyOpponentProgress(p: VSOpponentProgress) {
        opponent.attempts = p.attempts
        opponent.solved = p.solved
        opponent.boardsSolved = p.boardsSolved
        opponent.totalBoards = p.totalBoards
        p.latestGuess?.let { latest ->
            val rows = (opponent.tiles[latest.boardIndex] ?: emptyList()) + listOf(latest.tileStates())
            opponent.tiles = opponent.tiles + (latest.boardIndex to rows)
        }
    }

    private fun handleMatchEnded(data: VSMatchEnded) {
        result = data
        screen = VSScreen.RESULT
        recordResult(data)
        if (dailyVsActive) VSPlayLimit.markPlayedToday()
    }

    private fun recordResult(data: VSMatchEnded) {
        if (resultRecorded || AuthService.profile.value == null) return
        resultRecorded = true
        val won = data.winner == "player"
        val secs = (data.playerTime / 1000).roundToInt()
        val solved = game?.boardsSolvedCount ?: (if (won) 1 else 0)
        val total = game?.boardCount ?: 1
        val theSeed = seed
        val opponentSecs = (data.opponentTime / 1000).roundToInt()
        viewModelScope.launch {
            xpResult = GameResultsService.record(
                gameMode = mode, playType = "vs", won = won, guessCount = data.playerGuesses,
                timeSeconds = secs, boardsSolved = solved, totalBoards = total, seed = theSeed,
                solutions = game?.state?.value?.boards?.map { it.solution } ?: emptyList(),
                guesses = game?.state?.value?.boards?.firstOrNull()?.guesses ?: emptyList(),
            )
            // Single shared match-history row written only by the designated writer.
            if (data.recordMatch == true && data.opponentId != null) {
                GameResultsService.recordVsMatch(
                    gameMode = mode, opponentId = data.opponentId, won = won, isDraw = data.winner == "draw",
                    playerGuesses = data.playerGuesses, opponentGuesses = data.opponentGuesses,
                    playerTimeSec = secs, opponentTimeSec = opponentSecs, seed = theSeed,
                )
            }
        }
    }
}
