package com.wordocious.app.ui.vs

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.GameViewModel
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.BotConfig
import com.wordocious.app.data.BotDifficulty
import com.wordocious.app.data.BotEngine
import com.wordocious.app.data.BotPersonas
import com.wordocious.app.data.BotTier
import com.wordocious.app.data.CpuIdentity
import com.wordocious.app.data.CpuKind
import com.wordocious.app.data.CpuOpponent
import com.wordocious.app.data.CpuProgressionStore
import com.wordocious.app.data.LocalBotMatchService
import com.wordocious.app.data.VSTransport
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
import com.wordocious.app.todayUTCDate
import com.wordocious.core.BoardState
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
 * Supports ALL VS modes (board modes + Gauntlet + ProperNoundle — the latter two
 * ride the same shared GameViewModel path). Private-match invites (InviteService)
 * and achievement writes (checkAchievements via GameResultsService.record) are
 * wired too. Nothing VS is deferred on Android now.
 */
enum class VSScreen { ENTRY, QUEUE, MATCH, WAITING, RESULT, OPPONENT_LEFT, ALREADY_PLAYED_DAILY, NOT_CONFIGURED }
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
    var countdownIsRematch by mutableStateOf(false) // relabels the overlay for a rematch
    private var pendingCountdownSecs = 3            // held until the intro finishes
    var game by mutableStateOf<GameViewModel?>(null)
    val opponent = OpponentProgressState()
    var result by mutableStateOf<VSMatchEnded?>(null)
    /** Snapshot of MY final board state, captured at match_ended BEFORE any
     *  reset — the result recap renders my side from it so hint rows/tiles
     *  (Six/Seven/ProperNoundle) survive. The guess log alone can't reproduce
     *  them: it only has submitted words, while hint rows live in the board's
     *  guesses + hintEvaluations (reducer SubmitHint). Android's PN rides the
     *  same BoardState path, so one snapshot covers all modes. Cleared on
     *  rematch (beginMatch). */
    var myFinalBoards by mutableStateOf<List<BoardState>?>(null)
        private set
    var playerTimeMs by mutableStateOf(0)
    var rematch by mutableStateOf(RematchState.IDLE)
    var message by mutableStateOf<String?>(null)
    var dailyAnswer by mutableStateOf("")
    // Today's daily VS outcome for the already-played screen (true=won, false=lost, null=unknown).
    var dailyWon by mutableStateOf<Boolean?>(null)
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

    /** The MODE's board count, known from match start (web MODE_TOTAL_BOARDS /
     *  iOS VSModeInfo.totalBoards) — opponent.totalBoards is 0 until their
     *  first progress event, which made Quad/Octo show a single tall
     *  placeholder board in the opponent strip until the opponent typed. */
    val totalBoards: Int = when (mode) {
        GameMode.QUORDLE -> 4; GameMode.OCTORDLE -> 8
        GameMode.SEQUENCE -> 4; GameMode.RESCUE -> 4
        GameMode.GAUNTLET -> 21
        else -> 1
    }

    /** Every guess I submitted this match, in submission order (web/iOS
     *  myGuessLog) — the VS result recap replays it through the engine to
     *  rebuild my full board set (incl. across Gauntlet stages). */
    val myGuessLog = mutableListOf<String>()

    // Swappable transport: socket by default, hot-swapped to a client-side CPU
    // bot when the player picks "Play the CPU" (Pro-only practice).
    private var service: VSTransport = VSMatchService()

    // ── CPU-vs state ──
    var isCpu by mutableStateOf(false)
    var cpuPersona by mutableStateOf<CpuIdentity?>(null)
    private var cpuKind: CpuKind? = null
    var photoFinish by mutableStateOf<String?>(null)     // "photo" | "clutch"
    var cpuMilestone by mutableStateOf<Int?>(null)
    var cpuUnlock by mutableStateOf<String?>(null)
    var cpuStreak by mutableStateOf(0)
    var cpuSessionWins by mutableStateOf(0)
    var cpuSessionLosses by mutableStateOf(0)

    // Exposed read-only: the VS result FinalBoards replays multi-board/Gauntlet
    // recaps from the match seed (iOS build-87 parity).
    var seed = ""
        private set
    /** ProperNoundle: the answer's spaced display from match_start metadata —
     *  the result recap's fallback when the seed→puzzle lookup misses. */
    var puzzleDisplay: String? = null
        private set
    private var matchStartMs = 0.0
    private var resultRecorded = false
    private var countdownJob: Job? = null
    private var started = false

    val isPro: Boolean get() = AuthService.isProActive
    /** Live elapsed seconds for the in-match header clock (web vs-classic parity). */
    val matchElapsedSeconds: Int get() =
        if (matchStartMs > 0) (((System.currentTimeMillis() - matchStartMs) / 1000).toInt()).coerceAtLeast(0) else 0
    // Daily VS is one shared Classic puzzle per day for EVERYONE (web parity:
    // dropped the !isPro guard — Pro plays the same daily VS, then gets the
    // already-played screen with a "Play Unlimited VS" prompt).
    private val dailyVsActive: Boolean get() = isDaily && mode == GameMode.DUEL

    // ── Lifecycle ─────────────────────────────────────────────────────────────────
    fun start() {
        if (started) return
        started = true
        if (!service.isConfigured) { screen = VSScreen.NOT_CONFIGURED; return }

        val dailySeed: String? = if (dailyVsActive) generateDailySeed(todayUTCDate(), "DUEL_VS") else null
        if (dailyVsActive) {
            // Already played (local play-limit OR a server daily_results row →
            // correct cross-device)? Show the read-only finished screen for free
            // AND Pro users, instead of queueing.
            viewModelScope.launch {
                var played = VSPlayLimit.hasPlayedToday()
                if (!played) played = DailyResultsService.hasPlayedDailyVsToday()
                if (played) {
                    dailyAnswer = dailySeed?.let { generateSolutionsFromSeed(it, 1).firstOrNull() } ?: ""
                    dailyWon = DailyResultsService.dailyVsResult()
                    screen = VSScreen.ALREADY_PLAYED_DAILY
                } else {
                    connectAndQueue(dailySeed)
                }
            }
            return
        }
        // Standard flow: show the entry chooser (Quick Match / Bot Match / Invite)
        // first. Accepting a private invite link auto-joins the human queue.
        if (inviteCode != null) connectAndQueue(dailySeed) else screen = VSScreen.ENTRY
    }

    /** Quick Match — join the live human queue (deferred from mount so the entry
     *  chooser can offer Bot Match / Invite first). */
    fun joinHumanQueue() {
        val dailySeed: String? = if (dailyVsActive) generateDailySeed(todayUTCDate(), "DUEL_VS") else null
        screen = VSScreen.QUEUE
        connectAndQueue(dailySeed)
    }

    private fun connectAndQueue(dailySeed: String?) {
        wireHandlers()
        // Emit join_queue ONLY once the socket is actually connected. Emitting it
        // synchronously right after connect() drops the event — the socket.io Java
        // client, unlike the JS client, does NOT buffer pre-connection emits — which
        // left both players stuck on the "waiting" screen, connected but never
        // queued. Re-fires on reconnect while still in the queue (server dedupes by
        // player id); the screen guard avoids re-queuing once a match has started.
        service.onConnect = {
            if (screen == VSScreen.QUEUE) {
                service.joinQueue(mode = mode.name, dailySeed = dailySeed, inviteCode = inviteCode)
            }
        }
        service.connect(presenceId = AuthService.userId?.let { "u:$it" })
    }

    /** Swap the socket transport for a client-side CPU bot and start a match.
     *  Pro-gated in the UI. `ghost` supplies Beat-Your-Best pace; `fixedSeed` is
     *  the Bot-of-the-Day daily seed. */
    fun startCpu(kind: CpuKind, ghostGuesses: Int? = null, ghostTimeMs: Double? = null, fixedSeed: String? = null) {
        val oppId = CpuOpponent.opponentId(kind)
        val id = CpuOpponent.identity(oppId)
        cpuKind = kind
        cpuPersona = id
        isCpu = true
        countdownJob?.cancel()
        service.disconnect()
        var config = BotConfig(opponentId = oppId, ghostGuesses = ghostGuesses, ghostTimeMs = ghostTimeMs, fixedSeed = fixedSeed)
        if (kind == CpuKind.ADAPTIVE) {
            config = config.copy(adaptive = BotEngine.AdaptiveHint(winRate = minOf(0.9, 0.4 + CpuProgressionStore.load().streak * 0.05)))
        }
        val engineDifficulty = if (kind == CpuKind.ADAPTIVE) BotDifficulty.ADAPTIVE
        else runCatching { BotDifficulty.valueOf(id.tier.name) }.getOrDefault(BotDifficulty.MEDIUM)
        service = LocalBotMatchService(engineDifficulty, config)
        screen = VSScreen.QUEUE
        resultRecorded = false
        wireHandlers()
        service.onConnect = { if (screen == VSScreen.QUEUE) service.joinQueue(mode.name, null, null) }
        service.connect(null)
    }

    fun leave() {
        countdownJob?.cancel()
        service.leaveQueue()
        service.disconnect()
        game?.stopTimer()
    }

    /** CPU spectator: end the match now (bot's outcome is already fixed by its
     *  plan; the player's time was captured at completion) instead of watching
     *  the bot grind out its boards. */
    fun finishCpuNow() { if (isCpu) service.resolveNow() }

    fun forfeit() {
        // Forfeiting an IN-PROGRESS match counts as a loss and (for daily VS)
        // consumes today's play — you can't replay. The server credits the
        // opponent the win + writes the shared match row; this records OUR side
        // (user_stats VS loss + daily loss) since we leave before match_ended.
        // Bailing from the queue (no match yet) records nothing.
        // CPU practice is never a ranked loss: quitting a bot match records
        // nothing (parity with the clean-end CPU path / iOS / web).
        if ((screen == VSScreen.MATCH || screen == VSScreen.WAITING) && !resultRecorded && !isCpu) {
            resultRecorded = true
            val secs = if (matchStartMs > 0) max(0, ((System.currentTimeMillis() - matchStartMs) / 1000).toInt()) else 0
            val gc = game?.rowsUsed ?: 0
            val solved = game?.boardsSolvedCount ?: 0
            val total = game?.boardCount ?: 1
            val theSeed = seed
            val daily = dailyVsActive
            val m = mode
            if (daily) VSPlayLimit.markPlayedToday()
            viewModelScope.launch {
                GameResultsService.record(
                    gameMode = m, playType = "vs", won = false, guessCount = gc,
                    timeSeconds = secs, boardsSolved = solved, totalBoards = total, seed = theSeed,
                    solutions = game?.state?.value?.boards?.map { it.solution } ?: emptyList(),
                    guesses = game?.state?.value?.boards?.maxByOrNull { it.guesses.size }?.guesses ?: emptyList(),
                )
                // EVERY completed VS match (incl. a forfeit loss) accumulates on
                // the daily VS leaderboard — iOS/web parity (the daily-only gate
                // here skipped non-daily forfeits).
                DailyResultsService.recordDailyVsResult(m, false)
            }
        }
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
        service.onMatchStart = {
            puzzleDisplay = it.puzzleMetadata?.display
            beginMatch(it.seed, it.startTime)
        }
        service.onOpponentProgress = { applyOpponentProgress(it) }
        service.onOpponentStageCompleted = { opponent.stagesCleared = max(opponent.stagesCleared, it.stageIndex + 1) }
        service.onMatchEnded = { handleMatchEnded(it) }
        service.onRematchOffered = { rematch = RematchState.RECEIVED }
        service.onRematchDeclined = { rematch = RematchState.DECLINED }
        service.onRematchStart = {
            puzzleDisplay = it.puzzleMetadata?.display
            beginRematch(it.seed)
        }
        service.onOpponentLeft = { message = "Opponent left the match"; screen = VSScreen.OPPONENT_LEFT }
        service.onServerError = { message = it.message }
    }

    private fun handleMatchFound(data: VSMatchFound) {
        // Private match: flip the invite to accepted now that the server paired us
        // (parity with iOS handleMatchFound → InviteService.markAccepted).
        inviteCode?.let { code ->
            viewModelScope.launch {
                com.wordocious.app.data.InviteService.markInviteAccepted(code, data.matchId.ifEmpty { null })
            }
        }
        // Match-intro splash: resolve the opponent's public profile and the
        // all-time head-to-head record while the 2.5s intro plays.
        showIntro = true
        opponentInfo = null
        headToHead = null
        opponentUserId = data.opponentUserId
        if (CpuOpponent.isCpu(data.opponentUserId)) {
            // CPU opponent: use the persona identity locally — no profile / H2H fetch.
            val id = CpuOpponent.identity(data.opponentUserId!!)
            opponentInfo = HeadToHeadService.VsProfile(username = "${id.name} 🤖", avatarUrl = null, level = 0)
        } else data.opponentUserId?.let { oppId ->
            viewModelScope.launch {
                HeadToHeadService.fetchVsProfile(oppId)?.let { opponentInfo = it }
            }
            AuthService.userId?.let { myId ->
                viewModelScope.launch {
                    headToHead = HeadToHeadService.fetchHeadToHead(myId, oppId)
                }
            }
        }

        // Hold the countdown until the intro clash finishes — otherwise it ticks
        // hidden behind the splash and only a stale "1" flashes. startCountdownTick
        // (called from the intro's onDone) begins the visible 3-2-1.
        pendingCountdownSecs = max(1, data.countdownSeconds.toInt())
    }

    fun startCountdownTick() {
        if (countdown != null || screen != VSScreen.QUEUE) return
        val secs = pendingCountdownSecs
        countdown = secs
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            var c = secs
            while (c > 1) { delay(1000); c -= 1; countdown = c }
            // 3-2-1-GO: hold "GO!" (countdown == 0) — beginMatch fades it out.
            // Safety: if the match never starts, drop the overlay after 2.5s.
            delay(1000); countdown = 0
            delay(2500)
            if (countdown == 0 && screen == VSScreen.QUEUE) countdown = null
        }
    }

    /** Rematch start — no match-intro splash, so run a 3-2-1 countdown (mirrors
     *  the initial MATCH_COUNTDOWN) before the board resets instead of snapping
     *  straight into a new game. The bot is delayed the same 3s to stay aligned. */
    private fun beginRematch(newSeed: String) {
        rematch = RematchState.IDLE
        showIntro = false
        countdownIsRematch = true
        val start = System.currentTimeMillis().toDouble() + 3000
        countdown = 3
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            var c = 3
            while (c > 1) { delay(1000); c -= 1; countdown = c }
            delay(1000)
            beginMatch(newSeed, start)
        }
    }

    private fun beginMatch(newSeed: String, startMs: Double?) {
        seed = newSeed
        matchStartMs = startMs ?: (System.currentTimeMillis().toDouble())
        countdownIsRematch = false
        opponent.attempts = 0; opponent.solved = false
        opponent.boardsSolved = 0; opponent.totalBoards = 0
        opponent.stagesCleared = 0; opponent.tiles = emptyMap()
        result = null
        myFinalBoards = null
        rematch = RematchState.IDLE
        resultRecorded = false
        // 3-2-1-GO: if a countdown was running, flash "GO!" over the board's
        // first ~0.6s instead of cutting straight from "1" into the game.
        if (countdown != null) {
            countdown = 0
            countdownJob?.cancel()
            countdownJob = viewModelScope.launch { delay(600); if (countdown == 0) countdown = null }
        }
        // Per-match VS-upgrade resets (web resetPerMatchState).
        myGuessCount = 0
        myGuessLog.clear()
        myStatus = null
        callout = null; lastCallout = ""; calloutJob?.cancel(); calloutJob = null
        opponentTyping = false; typingHideJob?.cancel()
        prevOppBoardsSolved = 0
        opponentGuessTick = 0

        game?.stopTimer()
        val vm = GameViewModel(seed = newSeed, mode = mode, isVersus = true)
        // Relay the ACTUAL board this guess landed on (not a hardcoded 0) so the
        // server evaluates it against the right solution and the opponent's
        // per-board mini-board populates the correct board. Single-board /
        // quordle-style applyToAll modes still resolve to 0.
        vm.onGuessCommitted = { guess, boardIndex ->
            myGuessCount += 1
            myGuessLog.add(guess)
            service.submitGuess(guess, boardIndex)
        }
        vm.onBoardSolved = { idx -> service.boardSolved(idx) }
        // Gauntlet VS: relay each cleared stage so the opponent's "Stage N" badge
        // advances (mirrors iOS VSMatchViewModel onStageCompleted).
        vm.onStageCompleted = { stage -> service.stageCompleted(stage) }
        vm.onCompleted = { status, guesses ->
            val timeMs = max(0, (System.currentTimeMillis() - matchStartMs).toInt())
            playerTimeMs = timeMs
            myStatus = status
            // .WAITING BEFORE playerCompleted: a fast CPU can end the match
            // synchronously here (screen=RESULT); setting WAITING after would
            // clobber it and strand the match on the spectator screen.
            screen = VSScreen.WAITING
            service.playerCompleted(if (status == GameStatus.WON) "won" else "lost", guesses, timeMs)
        }
        game = vm
        screen = VSScreen.MATCH
    }

    private fun applyOpponentProgress(p: VSOpponentProgress) {
        // V6: a late in-flight progress event after the match ends (or between
        // rematch reset and rematch start) must not mutate opponent state --
        // it corrupted the result recap / freshly-reset rematch HUD.
        if (screen != VSScreen.MATCH && screen != VSScreen.WAITING) return
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

        // applyToAll modes (quordle/octordle/rescue) send latestGuesses — the
        // guess against every unsolved board — so all the opponent's per-board
        // mini-boards populate, not just board 0. Single-board / sequence use the
        // single latestGuess.
        val perBoard = p.latestGuesses ?: p.latestGuess?.let { listOf(it) } ?: emptyList()
        if (perBoard.isNotEmpty()) {
            SoundManager.playOpponentThunk()
            opponentGuessTick += 1
            var tiles = opponent.tiles
            for (g in perBoard) {
                tiles = tiles + (g.boardIndex to ((tiles[g.boardIndex] ?: emptyList()) + listOf(g.tileStates())))
            }
            opponent.tiles = tiles
            // "N greens!" keys off the focused board (single latestGuess) or the
            // first fanned-out board.
            val primary = p.latestGuess ?: perBoard[0]
            val greens = primary.tiles.count { it == "CORRECT" }
            val len = primary.tiles.size
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
        // Capture my ACTUAL final board state (immutable data classes — a plain
        // reference is a safe snapshot) before anything can reset the game.
        myFinalBoards = game?.state?.value?.boards
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
        // The freemium one-per-day lock stays gated on the daily flow (never CPU).
        if (dailyVsActive && !isCpu) {
            VSPlayLimit.markPlayedToday()
        }
    }

    private fun recordResult(data: VSMatchEnded) {
        if (resultRecorded || AuthService.profile.value == null) return
        resultRecorded = true
        val won = data.winner == "player"

        if (isCpu) {
            // Pure practice: record ONLY the separate vs_cpu bucket — no XP, no
            // matches row, no head-to-head, no achievements, no daily lock.
            val secs = (data.playerTime / 1000).roundToInt()
            viewModelScope.launch { GameResultsService.recordCpuResult(mode, won, data.playerGuesses, secs) }
            val tier = cpuPersona?.tier ?: BotTier.MEDIUM
            val outcome = CpuProgressionStore.recordGame(won, tier, BotPersonas.persona(tier).id)
            if (cpuKind == CpuKind.DAILY) CpuProgressionStore.recordBotOfDay(won, CpuProgressionStore.todayUtc())
            cpuStreak = outcome.progression.streak
            cpuMilestone = outcome.milestone
            cpuUnlock = outcome.unlockedPersona
            if (won) cpuSessionWins += 1 else cpuSessionLosses += 1
            if (won) {
                val margin = kotlin.math.abs(data.playerTime - data.opponentTime)
                val maxG = game?.state?.value?.boards?.firstOrNull()?.maxGuesses ?: 6
                photoFinish = if (margin < 2000) "photo" else if (data.playerGuesses >= maxG) "clutch" else null
            }
            return
        }
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
            // Web row shape (vs-game recordMatch): solutions + BOTH players'
            // guess words — mine from the finished game state (longest board =
            // full shared history), the opponent's from match_ended's guess log.
            if (data.recordMatch == true && data.opponentId != null) {
                GameResultsService.recordVsMatch(
                    gameMode = mode, opponentId = data.opponentId, won = won, isDraw = data.winner == "draw",
                    playerGuesses = data.playerGuesses, opponentGuesses = data.opponentGuesses,
                    playerTimeSec = secs, opponentTimeSec = opponentSecs, seed = theSeed,
                    solutions = data.solutions
                        ?: game?.state?.value?.boards?.map { it.solution }
                        ?: emptyList(),
                    player1Guesses = game?.state?.value?.boards?.maxByOrNull { it.guesses.size }?.guesses
                        ?: emptyList(),
                    player2Guesses = data.opponentGuessLog?.map { it.guess },
                    forfeit = data.forfeit == true,
                )
            }
        }
    }
}
