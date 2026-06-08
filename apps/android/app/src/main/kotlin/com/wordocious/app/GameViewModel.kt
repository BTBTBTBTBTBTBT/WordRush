package com.wordocious.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wordocious.app.data.GamePersistence
import com.wordocious.core.DictionaryLoader
import com.wordocious.core.GameAction
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.createInitialState
import com.wordocious.core.gameReducer
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
    private val seed: String,
    private val mode: GameMode,
    /** VS mode: relay guesses/solves/completion to the socket; skip local persistence. */
    private val isVersus: Boolean = false,
) : ViewModel() {

    // ── VS relay callbacks (null in solo; set by VSMatchViewModel) ────────────────
    var onGuessCommitted: ((String) -> Unit)? = null
    var onBoardSolved: ((Int) -> Unit)? = null
    var onStageCompleted: ((Int) -> Unit)? = null
    var onCompleted: ((GameStatus, Int) -> Unit)? = null

    private val _state = MutableStateFlow(run {
        DictionaryLoader.ensureLoaded()
        // VS games are ephemeral (fresh per match) — never resume from persistence.
        if (isVersus) createInitialState(seed, mode)
        else GamePersistence.load(seed, mode) ?: createInitialState(seed, mode)
    })
    val state: StateFlow<GameState> = _state.asStateFlow()

    // VS-facing helpers (mirror iOS GameViewModel surface used by VSMatchViewModel).
    val boardCount: Int get() = _state.value.boards.size
    val boardsSolvedCount: Int get() = _state.value.boards.count { it.status == GameStatus.WON }
    val maxGuesses: Int get() = _state.value.boards[_state.value.currentBoardIndex].maxGuesses
    val rowsUsed: Int get() = _state.value.boards.firstOrNull()?.guesses?.size ?: 0

    private val _input = MutableStateFlow("")
    val currentInput: StateFlow<String> = _input.asStateFlow()

    /**
     * Live elapsed seconds. For an in-progress game this is wall-clock from
     * startTime. For an ALREADY-finished game (resumed from persistence) we use
     * the frozen elapsed-at-finish so the displayed time/score stays correct
     * instead of growing from the original startTime.
     */
    private val _elapsed = MutableStateFlow(
        if (_state.value.status != GameStatus.PLAYING)
            GamePersistence.loadElapsed(seed, mode) ?: elapsedSeconds()
        else elapsedSeconds()
    )
    val elapsed: StateFlow<Int> = _elapsed.asStateFlow()

    private var timerJob: kotlinx.coroutines.Job? = null

    init {
        // Tick the elapsed timer once per second while the game is in progress.
        timerJob = viewModelScope.launch {
            while (true) {
                if (!isFinished) _elapsed.value = elapsedSeconds()
                delay(1000)
            }
        }
    }

    /** Active board's solution length — guess/input length must match it. */
    val wordLength: Int
        get() = _state.value.boards[_state.value.currentBoardIndex].solution.length

    val isFinished: Boolean
        get() = _state.value.status != GameStatus.PLAYING

    fun elapsedSeconds(): Int =
        ((System.currentTimeMillis() - _state.value.startTime) / 1000).toInt().coerceAtLeast(0)

    // Rejection feedback: a full-length guess that's invalid / already-guessed
    // turns the current row red and shakes it (bumping shakeKey). 1:1 with iOS.
    private val _invalidWord = MutableStateFlow(false)
    val invalidWord: StateFlow<Boolean> = _invalidWord.asStateFlow()
    private val _shakeKey = MutableStateFlow(0)
    val shakeKey: StateFlow<Int> = _shakeKey.asStateFlow()

    fun typeLetter(c: Char) {
        if (isFinished) return
        if (_input.value.length >= wordLength) return
        if (!c.isLetter()) return
        _invalidWord.value = false
        _input.value = _input.value + c.uppercaseChar()
    }

    fun deleteLetter() {
        if (_input.value.isNotEmpty()) {
            _invalidWord.value = false
            _input.value = _input.value.dropLast(1)
        }
    }

    /** Submit the typed input. Returns false if rejected (length/validity/no-op). */
    fun submit(applyToAll: Boolean = false): Boolean {
        if (isFinished) return false
        val guess = _input.value
        if (guess.length != wordLength) { reject(); return false }
        // Reject already-guessed words on the active board (UI rule; reducer doesn't dedupe).
        val activeBoard = _state.value.boards[_state.value.currentBoardIndex]
        if (activeBoard.guesses.any { it.equals(guess, ignoreCase = true) }) { reject(); return false }
        val before = _state.value
        val after = gameReducer(before, GameAction.SubmitGuess(guess, applyToAll = applyToAll))
        if (after === before || after == before) { reject(); return false } // dictionary-rejected
        _invalidWord.value = false
        _state.value = after
        _input.value = ""
        persist()
        // VS relay: report the guess, any newly-solved boards, and completion.
        if (isVersus) {
            onGuessCommitted?.invoke(guess.uppercase())
            after.boards.forEachIndexed { i, b ->
                if (b.status == GameStatus.WON && before.boards.getOrNull(i)?.status != GameStatus.WON) {
                    onBoardSolved?.invoke(i)
                }
            }
        }
        if (after.status != GameStatus.PLAYING) {
            val finishElapsed = elapsedSeconds()
            _elapsed.value = finishElapsed                       // freeze the displayed timer
            if (!isVersus) GamePersistence.saveElapsed(seed, mode, finishElapsed) // persist for re-entry
            if (isVersus) onCompleted?.invoke(after.status, after.boards.firstOrNull()?.guesses?.size ?: 0)
        }
        return true
    }

    /** Stop the elapsed-timer coroutine — call when a directly-instantiated VS VM is released. */
    fun stopTimer() { timerJob?.cancel() }

    /** Flag the current full-length guess invalid + trigger a shake. */
    private fun reject() {
        if (_input.value.length == wordLength) _invalidWord.value = true
        _shakeKey.value = _shakeKey.value + 1
    }

    fun dispatch(action: GameAction) {
        _state.value = gameReducer(_state.value, action)
        persist()
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

    /** The ProperNoundle puzzle behind this game (null for other modes). */
    val pnPuzzle: com.wordocious.core.NPuzzle? by lazy {
        if (mode != GameMode.PROPERNOUNDLE) null
        else com.wordocious.core.getDailySeedDate(seed)?.let { com.wordocious.core.ProperNoundle.dailyPuzzle(it) }
            ?: com.wordocious.core.ProperNoundle.puzzleForSeed(seed)
    }

    /** Hints used for scoring — PN counts clue+vowel+consonant; others count hint rows. */
    val hintsUsed: Int
        get() = if (mode == GameMode.PROPERNOUNDLE) {
            listOf(_clue.value, _vowelRevealed.value, _consonantRevealed.value).count { it != null }
        } else {
            _state.value.boards.firstOrNull()?.hintEvaluations?.size ?: 0
        }

    /** Reveal the Wikipedia clue (ProperNoundle only). */
    fun revealClue() {
        if (mode != GameMode.PROPERNOUNDLE || _clue.value != null || _loadingClue.value) return
        val p = pnPuzzle ?: return
        _loadingClue.value = true
        viewModelScope.launch {
            val fetched = com.wordocious.app.data.WikipediaHint.fetch(p.display, p.wikiTitle)
            _clue.value = fetched ?: p.hint ?: "Category: ${categoryLabel(p.themeCategory)}"
            _loadingClue.value = false
        }
    }

    private fun categoryLabel(c: String?): String =
        (c ?: "general").replaceFirstChar { it.uppercase() }

    fun revealVowel() = revealHint(vowels = true)
    fun revealConsonant() = revealHint(vowels = false)

    private fun revealHint(vowels: Boolean) {
        if (!hasHints || isFinished) return
        val board = _state.value.boards.firstOrNull() ?: return
        if (if (vowels) _vowelUsed.value else _consonantUsed.value) return
        val vset = setOf('A', 'E', 'I', 'O', 'U')
        val solution = board.solution.uppercase()
        val guessed = board.guesses.joinToString("").uppercase().toSet()
        val candidates = solution.filter { c ->
            c in 'A'..'Z' && (if (vowels) c in vset else c !in vset) && c !in guessed
        }.toSet().toList()

        val pick = candidates.randomOrNull()
        if (pick == null) {
            // None of that type left — mark used, reveal "—", add no row.
            if (vowels) { _vowelUsed.value = true; _vowelRevealed.value = "—" }
            else { _consonantUsed.value = true; _consonantRevealed.value = "—" }
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
        persist()
        if (_state.value.status != GameStatus.PLAYING) _elapsed.value = elapsedSeconds()
    }
}
