package com.wordocious.app.ui.vs

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.GameViewModel
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyResultsService
import com.wordocious.app.data.GameResultsService
import com.wordocious.app.data.HeadToHeadService
import com.wordocious.app.data.SoundManager
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
import kotlin.math.min
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
    var queueSize by mutableStateOf(0)
    var countdown by mutableStateOf<Int?>(null)     // non-null → "Match Found" overlay
    var game by mutableStateOf<GameViewModel?>(null)
    val opponent = OpponentProgressState()
    var result by mutableStateOf<VSMatchEnded?>(null)
    var playerTimeMs by mutableStateOf(0)
    var rematch by mutableStateOf(RematchState.IDLE)
    var message by mutableStateOf<String?>(null)
    var dailyAnswer by mutableStateOf("")
    var xpResult by mutableStateOf<GameResultsService.XpResult?>(null)

    // ── VS experience upgrade state (web vs-game.tsx parity) ─────────────────────
    /** Match-intro splash visibility — shown on match_found for 2.5s (tap-to-skip). */
    var showIntro by mutableStateOf(false)
    /** Opponent's Supabase user id from match_found, or null if anonymous. */
    var opponentUserId by mutableStateOf<String?>(null)
    var opponentInfo by mutableStateOf<HeadToHeadService.VsProfile?>(null)
    var headToHead by mutableStateOf<HeadToHeadService.HeadToHeadRecord?>(null)
    /** Total guesses I have submitted this match (web myGuessLog.length). */
    var myGuessCount by mutableStateOf(0)
    var myStatus by mutableStateOf<GameStatus?>(null)   // set when I finish (waiting screen stakes)
    /** Moment callout (top toast); deduped while one is visible, auto-dismissed at 2.5s. */
    var callout by mutableStateOf<String?>(null)
    /** Bumps once per opponent guess row — drives the UI's light haptic. */
    var opponentGuessTick by mutableStateOf(0)
    var opponentTyping by mutableStateOf(false)

    val opponentName: String get() = opponentInfo?.displayName ?: "Opponent"

    private var calloutJob: Job? = null
    private var lastCallout = ""
    private var typingHideJob: Job? = null
    private var lastTypingSentMs = 0L
    private var prevOppBoardsSolved = 0

    /** Server-side per-mode guess budgets — web VS_MODE_MAX_GUESSES. */
    val modeMaxGuesses: Int = when (mode) {
        GameMode.DUEL -> 6; GameMode.QUORDLE -> 9; GameMode.OCTORDLE -> 13
        GameMode.SEQUENCE -> 10; GameMode.RESCUE -> 6; GameMode.GAUNTLET -> 50
        GameMode.PROPERNOUNDLE -> 6; GameMode.DUEL_6 -> 7; GameMode.DUEL_7 -> 8
        else -> 6
    }

    /** Word length for the tug-of-war/mini boards — web MODE_WORD_LEN. */
    val wordLen: Int = when (mode) { GameMode.DUEL_6 -> 6; GameMode.DUEL_7 -> 7; else -> 5 }

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
        service.onQueueStatus = {
            queuePosition = it.position
            it.queueSize?.let { n -> queueSize = n }
        }
        service.onMatchFound = { handleMatchFound(it) }
        service.onOpponentTyping = {
            opponentTyping = true
            // Hide after 2s without fresh pings (the sender throttles to 1/1.5s).
            typingHideJob?.cancel()
            typingHideJob = viewModelScope.launch { delay(2000); opponentTyping = false }
        }
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
        // Match-intro splash: resolve the opponent's public profile and the
        // all-time head-to-head record while the 2.5s intro plays.
        showIntro = true
        opponentInfo = null
        headToHead = null
        opponentUserId = data.opponentUserId
        data.opponentUserId?.let { oppId ->
            viewModelScope.launch {
                HeadToHeadService.fetchVsProfile(oppId)?.let { opponentInfo = it }
            }
            AuthService.userId?.let { myId ->
                viewModelScope.launch {
                    headToHead = HeadToHeadService.fetchHeadToHead(myId, oppId)
                }
            }
        }

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
        // Per-match VS-upgrade resets (web resetPerMatchState).
        myGuessCount = 0
        myStatus = null
        callout = null; lastCallout = ""; calloutJob?.cancel(); calloutJob = null
        opponentTyping = false; typingHideJob?.cancel()
        prevOppBoardsSolved = 0
        opponentGuessTick = 0

        game?.stopTimer()
        val vm = GameViewModel(seed = newSeed, mode = mode, isVersus = true)
        vm.onGuessCommitted = { guess -> myGuessCount += 1; service.submitGuess(guess, 0) }
        vm.onBoardSolved = { idx -> service.boardSolved(idx) }
        vm.onCompleted = { status, guesses ->
            val timeMs = max(0, (System.currentTimeMillis() - matchStartMs).toInt())
            playerTimeMs = timeMs
            myStatus = status
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

        // Moment callouts (one per progress event, most dramatic first) — web parity.
        val name = opponentName
        var calloutText: String? = null
        if (p.boardsSolved > prevOppBoardsSolved && p.totalBoards > 1) {
            calloutText = "$name solved board ${p.boardsSolved}!"
        }
        prevOppBoardsSolved = p.boardsSolved

        p.latestGuess?.let { latest ->
            SoundManager.playOpponentThunk()
            opponentGuessTick += 1
            val rows = (opponent.tiles[latest.boardIndex] ?: emptyList()) + listOf(latest.tileStates())
            opponent.tiles = opponent.tiles + (latest.boardIndex to rows)
            val greens = latest.tiles.count { it == "CORRECT" }
            val len = latest.tiles.size
            if (calloutText == null && len >= 2 && greens == len - 1) {
                calloutText = "$name got $greens greens! 😱"
            }
        }
        if (calloutText == null && !p.solved && p.attempts == modeMaxGuesses - 1) {
            calloutText = "$name is on their last guess!"
        }
        calloutText?.let { showCallout(it) }
    }

    /** Top-toast callout — dedupes consecutive identical texts while one shows; 2.5s auto-dismiss. */
    private fun showCallout(text: String) {
        if (text == lastCallout && calloutJob?.isActive == true) return
        lastCallout = text
        callout = text
        calloutJob?.cancel()
        calloutJob = viewModelScope.launch {
            delay(2500)
            callout = null
            lastCallout = ""
        }
    }

    /**
     * Throttled typing relay (web handleTyping): at most one ping per 1.5s
     * while letters are in the current row — call on every input change.
     */
    fun notifyTyping() {
        val now = System.currentTimeMillis()
        if (now - lastTypingSentMs < 1500) return
        lastTypingSentMs = now
        service.emitTyping()
    }

    private fun handleMatchEnded(data: VSMatchEnded) {
        result = data
        screen = VSScreen.RESULT
        recordResult(data)
        // Refresh the head-to-head line so the result screen shows the UPDATED
        // record including this match. Small delay gives the single-writer
        // client's `matches` insert time to land (web: 1.2s).
        val oppId = data.opponentId
        val myId = AuthService.userId
        if (oppId != null && myId != null) {
            viewModelScope.launch {
                delay(1200)
                headToHead = HeadToHeadService.fetchHeadToHead(myId, oppId)
            }
        }
        // The freemium one-per-day lock stays gated on the daily flow.
        if (dailyVsActive) {
            VSPlayLimit.markPlayedToday()
        }
    }

    private fun recordResult(data: VSMatchEnded) {
        if (resultRecorded || AuthService.profile.value == null) return
        resultRecorded = true
        val won = data.winner == "player"
        // Web parity (stats-service): EVERY VS match lands on the daily VS
        // leaderboard (play_type='vs'). Inside the guard — a duplicate
        // match_ended event must not double-accumulate vs_wins/vs_games.
        viewModelScope.launch { DailyResultsService.recordDailyVsResult(mode, won) }
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
                guesses = game?.state?.value?.boards?.maxByOrNull { it.guesses.size }?.guesses ?: emptyList(), // longest board = full shared history
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
