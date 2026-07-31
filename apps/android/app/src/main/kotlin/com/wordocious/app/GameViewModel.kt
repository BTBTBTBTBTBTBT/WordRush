package com.wordocious.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.data.GamePersistence
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameAction
import com.wordocious.core.GameDictionary
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.createInitialState
import com.wordocious.core.gameReducer
import com.wordocious.core.gauntletStages
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI-state holder over the pure `:core` engine — the Kotlin analogue of the iOS
 * `GameViewModel`. Adds:
 *   - a live elapsed-time ticker (for the header + scoring),
 *   - local persistence (resume daily/in-progress games after backgrounding).
 *
 * All game rules live in [gameReducer]; this only tracks typed input + time and
 * forwards immutable state transitions to Compose.
 */
class GameViewModel(
    private var seed: String,
    private val mode: GameMode,
    /** VS mode: relay guesses/solves/completion to the socket; skip local persistence. */
    private val isVersus: Boolean = false,
) : ViewModel() {

    // ── VS relay callbacks (null in solo; set by VSMatchViewModel) ────────────────
    var onGuessCommitted: ((String, Int) -> Unit)? = null
    var onBoardSolved: ((Int) -> Unit)? = null
    var onStageCompleted: ((Int) -> Unit)? = null
    var onCompleted: ((GameStatus, Int) -> Unit)? = null

    private val _state = MutableStateFlow(run {
        DictionaryLoader.ensureLoaded()
        // VS games are ephemeral (fresh per match) — never resume from persistence.
        if (isVersus) createInitialState(seed, mode)
        else {
            // Cross-midnight grace (web/iOS parity): if today's daily has no
            // save but yesterday's is still in progress and fresh, adopt ITS
            // seed — persistence, elapsed time, and the recorded day all
            // follow, since the day derives from the seed, never the clock.
            if (com.wordocious.core.isDailySeed(seed) && GamePersistence.load(seed, mode) == null) {
                GamePersistence.gracedYesterdaySeed(seed, mode)?.let { seed = it }
            }
            GamePersistence.load(seed, mode) ?: createInitialState(seed, mode)
        }
    })
    val state: StateFlow<GameState> = _state.asStateFlow()

    // VS-facing helpers (mirror iOS GameViewModel surface used by VSMatchViewModel).
    val boardCount: Int get() = _state.value.boards.size
    val boardsSolvedCount: Int get() = _state.value.boards.count { it.status == GameStatus.WON }
    val maxGuesses: Int get() = _state.value.boards[activeBoardIndex].maxGuesses
    /** The mode's starting per-board row budget, captured before any play — VS
     *  opponent frames render this many empty rows from match start (the live
     *  maxGuesses can shrink mid-game, e.g. Gauntlet steal-guess). */
    val initialMaxGuesses: Int = _state.value.boards.firstOrNull()?.maxGuesses ?: 6
    /** Total guesses used — web parity: MAX across boards (a solved board stops
     *  accumulating, so boards[0] underreports when it solves early). */
    val rowsUsed: Int get() = _state.value.boards.maxOfOrNull { it.guesses.size } ?: 0

    private val _input = MutableStateFlow("")
    val currentInput: StateFlow<String> = _input.asStateFlow()

    // ── Active-play timer (web useActivePlayTimer / iOS accumulatedMs parity) ──
    // Accumulates only foregrounded play milliseconds: pauses on ON_STOP
    // (app backgrounded / closed), resumes on ON_START, and persists the
    // accumulated value with the game so re-entry resumes it instead of
    // counting wall-clock hours from the original startTime.
    private var accumulatedMs: Long =
        (GamePersistence.loadElapsed(seed, mode) ?: 0).toLong() * 1000L
    private var resumeAtMs: Long? = null

    /**
     * Live elapsed seconds. For an in-progress game this is the accumulated
     * active-play time. For an ALREADY-finished game (resumed from persistence)
     * we use the frozen elapsed-at-finish so the displayed time/score stays
     * correct instead of growing.
     */
    private val _elapsed = MutableStateFlow(
        if (_state.value.status != GameStatus.PLAYING)
            GamePersistence.loadElapsed(seed, mode) ?: 0
        else elapsedSeconds()
    )
    val elapsed: StateFlow<Int> = _elapsed.asStateFlow()

    private var timerJob: kotlinx.coroutines.Job? = null

    /** True while a GameScreen for this VM is composed. The VM is
     *  activity-scoped (no NavHost), so it outlives the screen — without this
     *  gate a foreground return while the user sits on Home would resume a
     *  stale game's clock. VS VMs never set it (they don't use this timer). */
    private var screenVisible = false

    /** Pauses on app background, resumes on foreground (process-wide). */
    private val lifecycleObserver = object : androidx.lifecycle.DefaultLifecycleObserver {
        override fun onStart(owner: androidx.lifecycle.LifecycleOwner) {
            if (screenVisible) resumeTimer()
        }
        override fun onStop(owner: androidx.lifecycle.LifecycleOwner) { pauseTimer() }
    }

    /** GameScreen entered composition — start counting active play. */
    fun onScreenEnter() {
        screenVisible = true
        resumeTimer()
    }

    /** GameScreen left composition — stop counting + persist elapsed-so-far. */
    fun onScreenExit() {
        screenVisible = false
        pauseTimer()
    }

    init {
        // Lifecycle registry requires the main thread; VS VMs are constructed
        // from socket callbacks, so hop via viewModelScope (Main.immediate).
        viewModelScope.launch {
            androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.addObserver(lifecycleObserver)
        }
        // Tick the elapsed timer once per second while the game is in progress.
        timerJob = viewModelScope.launch {
            while (true) {
                if (!isFinished) _elapsed.value = elapsedSeconds()
                delay(1000)
            }
        }
    }

    /** Start (or rebase) the running segment — no-op if finished or already running. */
    fun resumeTimer() {
        if (isFinished || resumeAtMs != null) return
        resumeAtMs = System.currentTimeMillis()
    }

    /** Flush the running segment into the accumulator and persist elapsed-so-far. */
    fun pauseTimer() {
        flushTimer()
        if (!isVersus) GamePersistence.saveElapsed(seed, mode, elapsedSeconds())
    }

    private fun flushTimer() {
        resumeAtMs?.let { r ->
            accumulatedMs += System.currentTimeMillis() - r
            resumeAtMs = null
        }
    }

    /** If the last action ended the game: stop accumulating, freeze + persist elapsed. */
    private fun finalizeIfFinished() {
        if (_state.value.status == GameStatus.PLAYING) return
        flushTimer()
        val finishElapsed = elapsedSeconds()
        _elapsed.value = finishElapsed
        if (!isVersus) GamePersistence.saveElapsed(seed, mode, finishElapsed)
    }

    override fun onCleared() {
        if (!isFinished) pauseTimer()
        androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.removeObserver(lifecycleObserver)
        super.onCleared()
    }

    /** Active board's solution length — guess/input length must match it. */
    val wordLength: Int
        get() = _state.value.boards[activeBoardIndex].solution.length

    val isFinished: Boolean
        get() = _state.value.status != GameStatus.PLAYING

    /** Wall-clock time the game was provably NOT playable (e.g. game-start ad). */
    private var pausedMs: Long = 0
    fun addPausedTime(ms: Long) { pausedMs += ms.coerceAtLeast(0) }

    /** Accumulated active-play seconds (running segment included, ad pauses excluded). */
    fun elapsedSeconds(): Int {
        val running = resumeAtMs?.let { System.currentTimeMillis() - it } ?: 0L
        return ((accumulatedMs + running - pausedMs) / 1000).toInt().coerceAtLeast(0)
    }

    // Rejection feedback — web parity (practice-game handleKey): the row turns
    // red + shakes, a message toast appears ("Not enough letters" / "Not in word
    // list" / "Already guessed"), input is ignored for 600ms then CLEARED, and
    // the message auto-dismisses at 1500ms.
    private val _invalidWord = MutableStateFlow(false)
    val invalidWord: StateFlow<Boolean> = _invalidWord.asStateFlow()
    private val _shakeKey = MutableStateFlow(0)
    val shakeKey: StateFlow<Int> = _shakeKey.asStateFlow()
    private val _rejectMessage = MutableStateFlow<String?>(null)
    val rejectMessage: StateFlow<String?> = _rejectMessage.asStateFlow()
    private var rejectJob: kotlinx.coroutines.Job? = null
    private var toastJob: kotlinx.coroutines.Job? = null

    fun typeLetter(c: Char) {
        if (isFinished) return
        if (_input.value.length >= wordLength) return
        if (!c.isLetter()) return
        _rejectMessage.value = null
        _input.value = _input.value + c.uppercaseChar()
        refreshLiveInvalid()
    }

    fun deleteLetter() {
        if (_input.value.isNotEmpty()) {
            _rejectMessage.value = null
            _input.value = _input.value.dropLast(1)
            refreshLiveInvalid()
        }
    }

    /**
     * Is the player on a one-board-at-a-time stage?
     *
     * True for standalone Succession AND for the Gauntlet "Succession" stage —
     * a sequential stage whose `mode` is GAUNTLET, not SEQUENCE. Web keys this
     * off `currentStageConfig.sequential` and iOS off `isSequence`; keying it
     * off the mode alone silently misses the Gauntlet case.
     *
     * THE SINGLE DEFINITION. This predicate previously existed in four places —
     * GameScreen, VSGameScreen, submitGuess and (mode-only) the two accessors
     * below — and two of them omitted the Gauntlet clause. That drift is what
     * broke the Gauntlet Succession stage after the standalone mode was fixed.
     * Derive from here; do not re-spell it.
     */
    val isSequentialStage: Boolean
        get() = mode == GameMode.SEQUENCE ||
            (_state.value.gauntlet?.let { gauntletStages.getOrNull(it.currentStage)?.sequential } == true)

    /**
     * Index of the board the player is actually on.
     *
     * NOTHING on any platform advances `state.currentBoardIndex` — the reducer
     * has a NextBoard action and no caller dispatches it, on web, iOS or here.
     * iOS never noticed because it derives the active board instead
     * (GameViewModel.swift:146, `firstIndex { $0.status == .playing }`). Android
     * got that right for guess ROUTING below and then handed the raw, forever-0
     * field to the UI — so in Succession the second board never unlocked, the
     * first was already won and refused input, and the mode was unplayable past
     * one word. Every UI consumer must use this, not the raw field.
     */
    val activeBoardIndex: Int
        get() = if (isSequentialStage)
            _state.value.boards.indexOfFirst { it.status == GameStatus.PLAYING }
                .let { if (it < 0) _state.value.boards.lastIndex else it }
        else _state.value.currentBoardIndex

    /** The board a guess lands on. A sequential stage's active board = first
     *  still-PLAYING (currentBoardIndex is never advanced); other modes use
     *  board 0's shared history. */
    private fun activeBoard() = if (isSequentialStage)
        (_state.value.boards.firstOrNull { it.status == GameStatus.PLAYING } ?: _state.value.boards[0])
    else _state.value.boards[_state.value.currentBoardIndex]

    /** Live invalid indicator (iOS BoardView parity): a full-length entry that
     *  isn't in the dictionary — or was already guessed on this board — turns the
     *  current row red WHILE typing, before ENTER. ProperNoundle answers aren't
     *  dictionary words and PN allows repeats, so it's excluded. */
    private fun refreshLiveInvalid() {
        val entry = _input.value
        _invalidWord.value = mode != GameMode.PROPERNOUNDLE && entry.length == wordLength &&
            (!GameDictionary.isValidWord(entry) ||
                activeBoard().guesses.any { it.equals(entry, ignoreCase = true) })
    }

    /** Submit the typed input. Returns false if rejected (length/validity/no-op). */
    fun submit(applyToAll: Boolean = false): Boolean {
        if (isFinished) return false
        val guess = _input.value
        if (guess.length != wordLength) { reject("Not enough letters"); return false }
        // Reject already-guessed words on the active board (UI rule; reducer doesn't
        // dedupe). ProperNoundle is exempt: iOS ProperNoundleVM.submit() never
        // dedupes, so re-submitting a name is a legal row-burning move there.
        val activeBoard = activeBoard()
        if (mode != GameMode.PROPERNOUNDLE &&
            activeBoard.guesses.any { it.equals(guess, ignoreCase = true) }
        ) { reject("Already guessed"); return false }
        val before = _state.value
        // Capture which board this guess lands on BEFORE the reducer runs — for
        // SEQUENCE the active board advances once it's solved, so reading the
        // active index afterward would report the NEXT board. The VS relay needs
        // the board the guess actually hit so the opponent's mini-board (and the
        // server's evaluation) target the right board. Also covers the Gauntlet
        // "Succession" stage (a sequential stage inside GAUNTLET mode) — mirrors
        // iOS's isSequence = mode == .sequence || currentGauntletStage.sequential.
        // `_state.value` is still `before` here (the reducer runs on the next
        // line), so the shared predicate sees the same stage the guess lands on.
        val committedBoardIndex = if (isSequentialStage)
            before.boards.indexOfFirst { it.status == GameStatus.PLAYING }.coerceAtLeast(0)
        else 0
        // Pass the index rather than letting the reducer default it. Its fallback
        // is `a.boardIndex ?: state.currentBoardIndex` — and currentBoardIndex is
        // never advanced by anything, so ANY caller that reaches the single-board
        // path on a sequential stage silently loses every guess after the first
        // solve (board 0 is WON, and the reducer returns state unchanged, which
        // surfaces as "Not in word list"). Callers have gotten `applyToAll` wrong
        // twice now; make the routing correct even when they do.
        val after = gameReducer(
            before,
            GameAction.SubmitGuess(guess, boardIndex = committedBoardIndex, applyToAll = applyToAll),
        )
        if (after === before || after == before) { reject("Not in word list"); return false } // dictionary-rejected
        _invalidWord.value = false
        _rejectMessage.value = null
        _state.value = after
        _input.value = ""
        persist()
        // iOS parity: a dark pill flashes the outcome the instant the final guess
        // lands — "Solved!" on a win, the unsolved answer (or "N left unsolved")
        // on a loss — before the reveal finishes and the overlay appears.
        if (after.status == GameStatus.WON) flash("Solved!")
        else if (after.status == GameStatus.LOST) flash(lossMessage(after))
        // VS relay: report the guess, any newly-solved boards, and completion.
        if (isVersus) {
            onGuessCommitted?.invoke(guess.uppercase(), committedBoardIndex)
            after.boards.forEachIndexed { i, b ->
                if (b.status == GameStatus.WON && before.boards.getOrNull(i)?.status != GameStatus.WON) {
                    onBoardSolved?.invoke(i)
                }
            }
        }
        if (after.status != GameStatus.PLAYING) {
            flushTimer()                                          // stop accumulating at finish
            val finishElapsed = elapsedSeconds()
            _elapsed.value = finishElapsed                       // freeze the displayed timer
            if (!isVersus) GamePersistence.saveElapsed(seed, mode, finishElapsed) // persist for re-entry
            if (isVersus) onCompleted?.invoke(after.status, after.boards.maxOfOrNull { it.guesses.size } ?: 0) // MAX across boards (board 0 stops at its solve)
        }
        return true
    }

    /** Stop the elapsed-timer coroutine — call when a directly-instantiated VS VM is released. */
    fun stopTimer() {
        timerJob?.cancel()
        // Directly-instantiated VS VMs never get onCleared — unhook the
        // process-lifecycle observer here (main-thread required).
        viewModelScope.launch {
            androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.removeObserver(lifecycleObserver)
        }
    }

    // ── Cross-device "view solved daily" (iOS parity) ─────────────────────────
    /** True when this VM's finished state was rebuilt by replaying the recorded
     *  guesses from the server (daily completed on another device / local state
     *  lost). GameScreen uses this to skip the VictoryOverlay and to NEVER
     *  re-record the replayed finish. */
    var wasReplayed: Boolean = false
        private set

    /**
     * Install a finished state reconstructed by replaying the recorded guesses
     * through the engine. Behaves like a finished-on-entry game: the displayed
     * timer is frozen at [elapsedSeconds] and both state + elapsed are persisted
     * so subsequent taps on this daily are instant local resumes.
     */
    fun installReplayedState(state: GameState, elapsedSeconds: Int) {
        wasReplayed = true
        _state.value = state
        resumeAtMs = null
        accumulatedMs = elapsedSeconds.toLong() * 1000L
        _elapsed.value = elapsedSeconds
        if (!isVersus) {
            GamePersistence.save(seed, mode, state)
            GamePersistence.saveElapsed(seed, mode, elapsedSeconds)
        }
    }

    /** Transient toast in the reject pill — iOS GameViewModel.flash(): 1.5s, and
     *  only cleared if a newer message hasn't replaced it. */
    private fun flash(message: String) {
        _rejectMessage.value = message
        toastJob?.cancel()
        toastJob = viewModelScope.launch {
            delay(1500)
            if (_rejectMessage.value == message) _rejectMessage.value = null
        }
    }

    /** iOS GameViewModel.lossMessage: the single unsolved answer, or a count. */
    private fun lossMessage(state: GameState): String {
        val unsolved = state.boards.filter { it.status != GameStatus.WON }.map { it.solution }
        return if (unsolved.size == 1) unsolved[0] else "${unsolved.size} left unsolved"
    }

    /**
     * Flag the rejected guess: red row (full-length only) + shake + toast.
     * Timing mirrors iOS rejectGuess: the row clears at 600ms but ONLY if the
     * player hasn't already started a new entry (keys are never swallowed), and
     * the toast auto-dismisses at 1500ms.
     */
    private fun reject(message: String) {
        if (_input.value.length == wordLength) _invalidWord.value = true
        _shakeKey.value = _shakeKey.value + 1
        flash(message)
        com.wordocious.app.data.SoundManager.playInvalid()
        // ProperNoundle keeps whatever was typed — iOS ProperNoundleVM.submit()
        // flashes "Not enough letters" and leaves the input intact.
        if (mode == GameMode.PROPERNOUNDLE) return
        val rejected = _input.value
        rejectJob?.cancel()
        rejectJob = viewModelScope.launch {
            delay(600)
            if (_input.value == rejected) {
                _input.value = ""
                _invalidWord.value = false
            }
        }
    }

    fun dispatch(action: GameAction) {
        _state.value = gameReducer(_state.value, action)
        persist()
    }

    /** True when the live Gauntlet stage is cleared (all boards won, run still
     *  in progress) — drives the stage-transition overlay (iOS stageCleared). */
    val gauntletStageCleared: Boolean
        get() = mode == GameMode.GAUNTLET && _state.value.status == GameStatus.PLAYING &&
            _state.value.boards.isNotEmpty() && _state.value.boards.all { it.status == GameStatus.WON }

    /** Advance to the next Gauntlet stage (or finish the run on the last stage).
     *  Mirrors iOS GameViewModel.nextStage(): NEXT_STAGE records the cleared
     *  stage + sets up the next, or flips the run to WON. When the run finishes
     *  here, freeze the timer + persist elapsed exactly like submit() does. */
    fun advanceGauntletStage() {
        if (!gauntletStageCleared) return
        _state.value = gameReducer(_state.value, GameAction.NextStage(elapsedMs = elapsedSeconds().toDouble() * 1000.0))
        persist()
        if (_state.value.status != GameStatus.PLAYING) {
            flushTimer()
            val finishElapsed = elapsedSeconds()
            _elapsed.value = finishElapsed
            if (!isVersus) GamePersistence.saveElapsed(seed, mode, finishElapsed)
        }
    }

    private fun persist() { if (!isVersus) GamePersistence.save(seed, mode, _state.value) }

    // ── Hints (Six / Seven / ProperNoundle) ──────────────────────────────────
    // Each hint reveals a random un-guessed vowel/consonant at all its positions
    // (CORRECT), others HINT_USED gray; consumes a guess row (submitHint). If none
    // of that type remains → mark used, reveal "—", add no row. 1:1 with iOS.
    val hasHints: Boolean
        get() = mode == GameMode.DUEL_6 || mode == GameMode.DUEL_7 || mode == GameMode.PROPERNOUNDLE

    private val _vowelUsed = MutableStateFlow(false)
    val vowelUsed: StateFlow<Boolean> = _vowelUsed.asStateFlow()
    private val _consonantUsed = MutableStateFlow(false)
    val consonantUsed: StateFlow<Boolean> = _consonantUsed.asStateFlow()
    private val _vowelRevealed = MutableStateFlow<String?>(null)
    val vowelRevealed: StateFlow<String?> = _vowelRevealed.asStateFlow()
    private val _consonantRevealed = MutableStateFlow<String?>(null)
    val consonantRevealed: StateFlow<String?> = _consonantRevealed.asStateFlow()

    // ProperNoundle Clue hint (Wikipedia) — only for PROPERNOUNDLE.
    private val _clue = MutableStateFlow<String?>(null)
    val clue: StateFlow<String?> = _clue.asStateFlow()
    private val _loadingClue = MutableStateFlow(false)
    val loadingClue: StateFlow<Boolean> = _loadingClue.asStateFlow()

    // Restore the hint UI flags + clue text on resume. The board guesses (incl.
    // the gray hint rows) already come back via GamePersistence.load(), but
    // these flags live outside GameState, so without this a resumed Six/Seven/
    // ProperNoundle would re-enable spent hint buttons and drop the clue text.
    // This init runs AFTER the flows above are constructed (declaration order).
    init {
        if (hasHints && !isVersus) {
            GamePersistence.loadHints(seed, mode)?.let { h ->
                _clue.value = h.clue
                _vowelRevealed.value = h.vowelRevealed
                _consonantRevealed.value = h.consonantRevealed
                _vowelUsed.value = h.vowelUsed
                _consonantUsed.value = h.consonantUsed
            }
        }
    }

    private fun persistHints() {
        if (isVersus) return
        GamePersistence.saveHints(seed, mode, GamePersistence.HintState(
            clue = _clue.value,
            vowelRevealed = _vowelRevealed.value,
            consonantRevealed = _consonantRevealed.value,
            vowelUsed = _vowelUsed.value,
            consonantUsed = _consonantUsed.value,
        ))
    }

    /** The ProperNoundle puzzle behind this game (null for other modes). */
    val pnPuzzle: com.wordocious.core.NPuzzle? by lazy {
        if (mode != GameMode.PROPERNOUNDLE) null
        else com.wordocious.core.getDailySeedDate(seed)?.let { com.wordocious.core.ProperNoundle.dailyPuzzle(it) }
            ?: com.wordocious.core.ProperNoundle.puzzleForSeed(seed)
    }

    /** Hints taken that had no candidate letter left ("—") — they add no board
     *  row, but web useClassicHints still marks them used, so they must count
     *  toward the hint penalty (web parity). */
    private var noCandidateHints = 0

    /** Hints used for scoring — PN counts clue+vowel+consonant; others count
     *  hint rows PLUS zero-candidate hints (web sets used=true even when no
     *  letter remained to reveal). */
    val hintsUsed: Int
        get() = if (mode == GameMode.PROPERNOUNDLE) {
            listOf(_clue.value, _vowelRevealed.value, _consonantRevealed.value).count { it != null }
        } else {
            (_state.value.boards.firstOrNull()?.hintEvaluations?.size ?: 0) + noCandidateHints
        }

    /** Reveal the Wikipedia clue (ProperNoundle only). Web parity
     *  (propernoundle-game handleHintClue + use-hints fetchClue): the clue
     *  COSTS A GUESS ROW — an all-gray hint-used row is pushed onto the board
     *  and can trigger the loss when it fills the last of the 6 rows. */
    fun revealClue() {
        if (mode != GameMode.PROPERNOUNDLE || _clue.value != null || _loadingClue.value || isFinished) return
        val p = pnPuzzle ?: return
        _loadingClue.value = true
        viewModelScope.launch {
            val fetched = com.wordocious.app.data.WikipediaHint.fetch(p.display, p.wikiTitle)
            _clue.value = fetched ?: p.hint ?: "Category: ${categoryLabel(p.themeCategory)}"
            _loadingClue.value = false
            // Consume a row: blank letters, every tile HINT_USED gray (web row
            // shape: { word: '', tiles: 'hint-used' × answerLength }).
            val board = _state.value.boards.firstOrNull() ?: return@launch
            if (board.status != GameStatus.PLAYING) return@launch
            val len = board.solution.length
            val tiles = List(len) {
                com.wordocious.core.TileResult(letter = "", state = com.wordocious.core.TileState.HINT_USED)
            }
            val eval = com.wordocious.core.GuessResult(tiles = tiles, isCorrect = false)
            _state.value = gameReducer(_state.value, GameAction.SubmitHint(" ".repeat(len), eval, boardIndex = 0))
            persist(); persistHints()
            finalizeIfFinished()
        }
    }

    private fun categoryLabel(c: String?): String = properNoundleCategoryLabel(c)

    fun revealVowel() = revealHint(vowels = true)
    fun revealConsonant() = revealHint(vowels = false)

    private fun revealHint(vowels: Boolean) {
        if (!hasHints || isFinished) return
        val board = _state.value.boards.firstOrNull() ?: return
        if (if (vowels) _vowelUsed.value else _consonantUsed.value) return
        val vset = setOf('A', 'E', 'I', 'O', 'U')
        val solution = board.solution.uppercase()
        val guessed = board.guesses.joinToString("").uppercase().toSet()
        // iOS ProperNoundleView.reveal() pools EVERY distinct vowel/consonant in
        // the answer, already-guessed letters included; Six/Seven still skip them.
        val candidates = solution.filter { c ->
            c in 'A'..'Z' && (if (vowels) c in vset else c !in vset) &&
                (mode == GameMode.PROPERNOUNDLE || c !in guessed)
        }.toSet().toList()

        val pick = candidates.randomOrNull()
        if (pick == null) {
            // None of that type left — mark used, reveal the sentinel, add no row.
            // Still counts toward the hint penalty (web sets used=true here).
            // iOS spells it "None" on the PN pill; Six/Seven keep "—" (their pill
            // maps that to "No vowels left").
            noCandidateHints += 1
            val none = if (mode == GameMode.PROPERNOUNDLE) "None" else "—"
            if (vowels) { _vowelUsed.value = true; _vowelRevealed.value = none }
            else { _consonantUsed.value = true; _consonantRevealed.value = none }
            persistHints()
            return
        }
        val tiles = solution.map { ch ->
            com.wordocious.core.TileResult(
                letter = if (ch == pick) ch.toString() else "",
                state = if (ch == pick) com.wordocious.core.TileState.CORRECT else com.wordocious.core.TileState.HINT_USED,
            )
        }
        val hintWord = solution.map { if (it == pick) it else ' ' }.joinToString("")
        val eval = com.wordocious.core.GuessResult(tiles = tiles, isCorrect = false)
        _state.value = gameReducer(_state.value, GameAction.SubmitHint(hintWord, eval, boardIndex = 0))
        if (vowels) { _vowelUsed.value = true; _vowelRevealed.value = pick.toString() }
        else { _consonantUsed.value = true; _consonantRevealed.value = pick.toString() }
        persist(); persistHints()
        finalizeIfFinished()
    }
}

/** Humanized ProperNoundle theme-category names — 1:1 with the iOS
 *  `categoryLabels` map in ProperNoundleView.swift (used by the clue fallback
 *  and the share card). Unknown keys fall back to a capitalized raw key. */
internal fun properNoundleCategoryLabel(c: String?): String = when (c) {
    "music" -> "Music"
    "videogames" -> "Video Games"
    "movies" -> "Movies & TV"
    "sports" -> "Sports"
    "history" -> "History"
    "science" -> "Science"
    "currentevents" -> "Current Events"
    else -> (c ?: "general").replaceFirstChar { it.uppercase() }
}
